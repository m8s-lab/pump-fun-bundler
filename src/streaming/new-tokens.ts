import Client, { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import base58 from "bs58";

import { BUY_SOL_AMOUNT, LAUNCH_MAX_BUY_SOL, LAUNCH_MIN_BUY_SOL, userKp } from "../core/config/env";
import { MINT_POST_BALANCE, PUMP_FUN, RAYDIUM, BELIEVE, METEORA_DBC_PROGRAM, TARGET_WALLETS } from "../core/constants";
import { PumpFunSDK } from "../lib/pumpfun/pumpfun";
import { setHasEnoughBalance } from "../core/global";
import { errorLogger, logLogger } from "../utils/logger";
import { handleCreate } from "../handler/handle-create";
import { findInstructionWithDiscriminator as findCpiIx } from "../utils/web3";
import { handleMigrate } from "../handler/handle-migrate";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { parseMetadata } from "../utils/metadata";
import { NATIVE_MINT } from "@solana/spl-token";

//grpc endpoint from Solana Vibe Station obviously
const client = new Client("https://grpc.solanavibestation.com", undefined, undefined);

(async () => {
    const version = await client.getVersion();  //  gets the version information
    console.log("grpc version: ", version);
})();

export const streamNewTokens = async () => {
    const stream = await client.subscribe();

    //  parse token lauch on pupmpfun, raydium launchpad, believe(launchcoin)
    const parseLaunchTransaction = async (
        data: any,
        CREATE_IX_DISCRIMINATOR: Buffer<ArrayBuffer>,
    ) => {
        const launchpad = data.filters[0];
        const transaction = data.transaction.transaction;
        const instructions = transaction.transaction.message.instructions;
        const meta = transaction.meta;
        const accountKeys = transaction.transaction.message.accountKeys;

        //  check if it has mint ix
        const idxCreateIx = instructions.findIndex((ix: { programIdIndex: number, accounts: Uint8Array, data: Uint8Array }) =>
            CREATE_IX_DISCRIMINATOR.length <= ix.data.length &&
            CREATE_IX_DISCRIMINATOR.every((value, i) => value === ix.data[i])
        );
        if (idxCreateIx == -1)
            throw (`${launchpad}: can not find create ix`);

        //  find inner instruction that has CPILog
        const innerInxs = meta.innerInstructions;

        const createMetadataIx = innerInxs[0].instructions.find((ix: any) => ix.data[0] == 33);
        if (!createMetadataIx) {
            logLogger.log(`${launchpad}: can not find metadata create ix`);
            return;
        }
        const metadata = parseMetadata(createMetadataIx.data);

        //  find mint
        const mintIdx = meta.postBalances.findIndex((n: number) => n == MINT_POST_BALANCE);
        if (mintIdx == undefined) {
            logLogger.log(`${launchpad}: can not find mint with lamports`);
            return;
        }
        const mint = base58.encode(accountKeys[mintIdx]);
        if ((launchpad == "pumpfun" && !mint.endsWith("pump"))
            || (launchpad == "raydiumlaunch" && !mint.endsWith("bonk")))
            return;

        const preBalances = meta.preBalances;
        const postBalances = meta.postBalances;
        //  get buy amount
        let buyLamports = 0;
        if (launchpad == "raydiumlaunch" || launchpad == "pumpfun") {
            buyLamports = (preBalances[0] - postBalances[0]) - 0.02 * LAMPORTS_PER_SOL;

            if (buyLamports < LAUNCH_MIN_BUY_SOL || buyLamports > LAUNCH_MAX_BUY_SOL) {
                // logLogger.log("invalid buy amount, buyLamports:", (buyLamports / LAMPORTS_PER_SOL).toFixed(1));
                return;
            }
        }

        //  get token supply
        const supply = meta.postTokenBalances!.reduce((accumulator: number, currentValue: any) => accumulator + (currentValue.uiTokenAmount.uiAmount || 0), 0);

        //  get vault addr
        let vault = null;
        if (launchpad == "believe") {
            const index = postBalances.findIndex((balance: number) => balance == 3841920);
            vault = PublicKey.findProgramAddressSync([
                Buffer.from("token_vault"), NATIVE_MINT.toBuffer(), accountKeys[index]],
                METEORA_DBC_PROGRAM)[0];
        } else {
            const { max, index } = preBalances.reduce((acc: { max: number, index: number }, pre: number, i: number) => {
                const diff = postBalances[i] - pre;
                if (diff > acc.max) {
                    acc.max = diff;
                    acc.index = i;
                }
                return acc;
            }, { max: 0, index: -1 });

            vault = base58.encode(accountKeys[index]);
        }

        //  get token vault addr
        const maxIndex = meta.postTokenBalances!.reduce((maxIndex: any, currentItem: any, currentIndex: any) => {
            return (currentItem.uiTokenAmount.uiAmount || 0) > (meta.postTokenBalances![maxIndex].uiTokenAmount.uiAmount || 0) ? currentIndex : maxIndex;
        }, 0);
        if (maxIndex == undefined) {
            errorLogger.error(`can not find max token value, tx: ${base58.encode(transaction.signature)}`);
            return
        };
        const tokenVault = base58.encode(accountKeys[meta.postTokenBalances![maxIndex].accountIndex]);

        //  handle token create
        await handleCreate(launchpad, metadata.name, metadata.symbol, metadata.uri,
            new PublicKey(mint), new PublicKey(vault), new PublicKey(tokenVault),
            base58.encode(transaction.signature), buyLamports, supply);
    }

    const parsePumpMigrate = async (data: any) => {
        const transaction = data.transaction.transaction;
        const instructions = transaction.transaction.message.instructions;
        const meta = transaction.meta;

        //  check if it has migrate ix
        const idxCreateIx = instructions.findIndex((ix: { programIdIndex: number, accounts: Uint8Array, data: Uint8Array }) =>
            PUMP_FUN.MIGRATE_IX_DISCRIMINATOR.length <= ix.data.length &&
            PUMP_FUN.MIGRATE_IX_DISCRIMINATOR.every((value, i) => value === ix.data[i])
        );
        if (idxCreateIx == -1) {
            logLogger.log("pumpMigrate: can not find create ix");
            return;
        }

        //  find inner instruction that has CPILog
        const innerInxs = meta.innerInstructions;
        const cpiIx = findCpiIx(innerInxs, PUMP_FUN.MIGRATE_CPI_DISCRIMINATOR);
        if (cpiIx == null) {
            logLogger.log("pumpMigrate: can not find migrate CPI");
            return;
        }
        const migrateData = new PumpFunSDK().parseMigrateCpiLog(cpiIx.data);

        //  check if it has target wallet
        let hasTarget = false;
        const accountKeys: Buffer[] = transaction.transaction.message.accountKeys;
        for (let i = 0; i < accountKeys.length; i++) {
            for (let j = 0; j < TARGET_WALLETS.length; j++) {
                if (base58.encode(accountKeys[i]) == TARGET_WALLETS[j]) {
                    hasTarget = true;
                    break;
                }
            }

            if (hasTarget == true)
                break;
        }

        //  get pool balance
        const buyCpiIx = findCpiIx(innerInxs, PUMP_FUN.BUY_CPI_DISCRIMINATOR);
        let solReserve = BigInt(0);
        let tokenReserve = BigInt(0);
        let coinCreator = PublicKey.default;
        if (!buyCpiIx) {
            logLogger.log("can not find buy ix");
        } else {
            const buyData = new PumpFunSDK().parseBuyCpiLog(buyCpiIx.data);
            solReserve = buyData.poolQuoteTokenReserves + buyData.quoteAmountInWithLpFee;
            tokenReserve = buyData.poolBaseTokenReserves - buyData.baseAmountOut;
            coinCreator = buyData.coinCreator;
        }

        //  handle token migrate
        await handleMigrate(migrateData, base58.encode(transaction.signature), solReserve, tokenReserve, coinCreator, hasTarget);
    }

    //  Collect all incoming events
    stream.on("data", async (data: any) => {
        if (data.filters.includes('wallet')) {
            //  check wallet balance
            const lamports = data.account.account.lamports;
            logLogger.log("balance: ", lamports / LAMPORTS_PER_SOL);

            const hasEnoughBalance = lamports >= (BUY_SOL_AMOUNT * LAMPORTS_PER_SOL);
            setHasEnoughBalance(hasEnoughBalance);

            return;
        }

        try {
            if (data.filters[0] == 'pumpfun') {
                //  stream new pump tokens
                await parseLaunchTransaction(data, PUMP_FUN.CREATE_IX_DISCRIMINATOR);
                return;
            } else if (data.filters[0] == 'pumpswap') {
                //  stream pump swap migrate
                await parsePumpMigrate(data);
                return;
            } else if (data.filters[0] == 'raydiumlaunch') {
                //  stream new tokens on raydium launchpad
                await parseLaunchTransaction(data, RAYDIUM.CREATE_IX_DISCRIMINATOR);
                return;
            } else if (data.filters[0] == 'believe') {
                //  stream new tokens on raydium launchpad
                await parseLaunchTransaction(data, BELIEVE.CREATE_IX_DISCRIMINATOR);
                return;
            }
        } catch (e) {
            errorLogger.log(base58.encode(data.transaction.transaction.signature));
            errorLogger.log(e as string);
        }
    });

    //  Create a subscription request
    const request: SubscribeRequest = {
        slots: {},
        accounts: {
            //  subscribe wallet balance change
            wallet: {
                account: [userKp.publicKey.toBase58()],
                owner: [SystemProgram.programId.toBase58()],
                filters: []
            }
        },
        transactions: {
            //  subscribe token create on pumpfun
            pumpfun: {
                vote: false,
                failed: false,
                accountInclude: [],
                accountExclude: [],
                accountRequired: [
                    PUMP_FUN.PROGRAM_ID,
                    PUMP_FUN.MINT_AUTH.toBase58(),
                    MPL_TOKEN_METADATA_PROGRAM_ID
                ]
            },
            //  subscribe token migration from pumpfun to pumpswap
            pumpswap: {
                vote: false,
                failed: false,
                accountInclude: [],
                accountExclude: [],
                accountRequired: [
                    PUMP_FUN.AMM_PROGRAM_ID,
                    PUMP_FUN.PROGRAM_ID,
                    PUMP_FUN.MIGRATION
                ]
            },
            //  subscribe token launch on raydium launchpad
            raydiumlaunch: {
                vote: false,
                failed: false,
                accountInclude: [],
                accountExclude: [],
                accountRequired: [
                    RAYDIUM.LAUNCHPAD_AUTHORITY,
                    MPL_TOKEN_METADATA_PROGRAM_ID
                ]
            },
            //  subscribe token creation by believe(launchcoin)
            believe: {
                vote: false,
                failed: false,
                accountInclude: [],
                accountExclude: [],
                accountRequired: [
                    BELIEVE.AUTHORITY,
                    MPL_TOKEN_METADATA_PROGRAM_ID
                ]
            }
        },
        blocks: {},
        blocksMeta: {},
        accountsDataSlice: [],
        commitment: CommitmentLevel.PROCESSED, // Subscribe to processed blocks for the fastest updates
        entry: {},
        transactionsStatus: {}
    };

    //  Sending a subscription request
    try {
        await new Promise<void>((resolve, reject) => {
            stream.write(request, (err: null | undefined) => {
                if (err === null || err === undefined) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    } catch (reason) {
        logLogger.log(reason as string);
        throw reason;
    }
}
