import {
    AddressLookupTableAccount,
    Blockhash,
    ComputeBudgetProgram,
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js"
import {
    TOKEN_PROGRAM_ID,
    ACCOUNT_SIZE,
    createInitializeAccountInstruction,
} from "@solana/spl-token"
import { DexInstructions, Market } from "@project-serum/serum"
import { BN } from "@coral-xyz/anchor";
import { raydiumProgramId } from "../core/config/env";
import { buildJitoTipIx } from "./jito";

const EVENT_QUEUE_LENGTH = 2978;
const EVENT_SIZE = 88;
const EVENT_QUEUE_HEADER_SIZE = 32;

const REQUEST_QUEUE_LENGTH = 63;
const REQUEST_SIZE = 80;
const REQUEST_QUEUE_HEADER_SIZE = 32;

const ORDERBOOK_LENGTH = 909;
const ORDERBOOK_NODE_SIZE = 72;
const ORDERBOOK_HEADER_SIZE = 40;
const LOT_SIZE = -3;
const TICK_SIZE = 8;

export function calculateTotalAccountSize(
    individualAccountSize: number,
    accountHeaderSize: number,
    length: number
) {
    const accountPadding = 12;
    const minRequiredSize =
        accountPadding + accountHeaderSize + length * individualAccountSize;

    const modulo = minRequiredSize % 8;

    return modulo <= 4
        ? minRequiredSize + (4 - modulo)
        : minRequiredSize + (8 - modulo + 4);
};

const TOTAL_EVENT_QUEUE_SIZE = calculateTotalAccountSize(
    128,
    EVENT_QUEUE_HEADER_SIZE,
    EVENT_SIZE
);

const TOTAL_REQUEST_QUEUE_SIZE = calculateTotalAccountSize(
    10,
    REQUEST_QUEUE_HEADER_SIZE,
    REQUEST_SIZE
);

const TOTAL_ORDER_BOOK_SIZE = calculateTotalAccountSize(
    201,
    ORDERBOOK_HEADER_SIZE,
    ORDERBOOK_NODE_SIZE
);

const getVaultNonce = (market: PublicKey, programId: PublicKey) => {
    let seedNum = 0;

    while (true) {
        const result = getVaultOwnerAndNonce(
            market,
            programId,
            seedNum
        );

        if (result) return result;
        else seedNum++;
    }
}


export const getVaultOwnerAndNonce = (
    marketAddress: PublicKey,
    dexAddress: PublicKey,
    seedNum: number
): [vaultOwner: PublicKey, nonce: BN] | undefined => {
    let nonce = new BN(seedNum);
    // console.log("nonce:", nonce);
    try {
        // console.log("market address: ", marketAddress.toBase58());
        // console.log("dex address: ", dexAddress.toBase58());

        const vaultOwner = PublicKey.createProgramAddressSync(
            [marketAddress.toBuffer(), nonce.toArrayLike(Buffer, "le", 8)],
            dexAddress
        );
        // console.log("vault owner ", vaultOwner.toBase58());
        return [vaultOwner, nonce];
    } catch (e) {
        // console.log('error in getVaultOwnerAndNonce');
    }
}


export const createMarket = (
    userKp: Keypair,

    baseMint: PublicKey,
    baseMintDecimals: number,

    quoteMint: PublicKey,
    quoteMintDecimals: number,

    blockhash: Blockhash,
) => {
    const vaultInstructions: TransactionInstruction[] = []
    const marketInstructions: TransactionInstruction[] = []

    // const timeOut = setTimeout(async () => {
    //     console.log("Trying market creation again");
    //     const marketId = await createMarket(userKp, baseMint, baseMintDecimals, quoteMint, quoteMintDecimals, connection);
    //     return marketId;
    // }, 20000);

    const marketAccounts = {
        market: Keypair.generate(),
        requestQueue: Keypair.generate(),
        eventQueue: Keypair.generate(),
        bids: Keypair.generate(),
        asks: Keypair.generate(),
        baseVault: Keypair.generate(),
        quoteVault: Keypair.generate(),
    }
    const [vaultOwner, vaultOwnerNonce] = getVaultNonce(
        marketAccounts.market.publicKey,
        raydiumProgramId.OPENBOOK_MARKET
    );

    // create vaults
    vaultInstructions.push(
        SystemProgram.createAccount({
            fromPubkey: userKp.publicKey,
            newAccountPubkey: marketAccounts.baseVault.publicKey,
            lamports: 2039280,  //  rent exempt
            space: 165, //  ACOCUNT_SIZE of token account
            programId: TOKEN_PROGRAM_ID,
        }),
        SystemProgram.createAccount({
            fromPubkey: userKp.publicKey,
            newAccountPubkey: marketAccounts.quoteVault.publicKey,
            lamports: 2039280,  //  rent exempt
            space: 165, //  ACOCUNT_SIZE of token account
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeAccountInstruction(
            marketAccounts.baseVault.publicKey,
            baseMint,
            vaultOwner
        ),
        createInitializeAccountInstruction(
            marketAccounts.quoteVault.publicKey,
            quoteMint,
            vaultOwner
        )
    );

    // clearTimeout(timeOut);
    // tickSize and lotSize here are the 1e^(-x) values, so no check for ><= 0
    const baseLotSize = Math.round(
        10 ** baseMintDecimals * Math.pow(10, -1 * LOT_SIZE)
    );
    const quoteLotSize = Math.round(
        10 ** quoteMintDecimals *
        Math.pow(10, -1 * LOT_SIZE) *
        Math.pow(10, -1 * TICK_SIZE)
    );

    // create market account
    marketInstructions.push(
        SystemProgram.createAccount({
            newAccountPubkey: marketAccounts.market.publicKey,
            fromPubkey: userKp.publicKey,
            space: 388, //  Market.getLayout(raydiumProgramId.OPENBOOK_MARKET).span
            lamports: 3591360,  //  rent exempt
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    // create request queue
    marketInstructions.push(
        SystemProgram.createAccount({
            newAccountPubkey: marketAccounts.requestQueue.publicKey,
            fromPubkey: userKp.publicKey,
            space: 844, //  TOTAL_REQUEST_QUEUE_SIZE
            lamports: 6765120,  //  rent exempt
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    // create event queue
    marketInstructions.push(
        SystemProgram.createAccount({
            newAccountPubkey: marketAccounts.eventQueue.publicKey,
            fromPubkey: userKp.publicKey,
            space: 11308,   //  TOTAL_EVENT_QUEUE_SIZE
            lamports: 79594560,
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    // create bids
    marketInstructions.push(
        SystemProgram.createAccount({
            newAccountPubkey: marketAccounts.bids.publicKey,
            fromPubkey: userKp.publicKey,
            space: 14524,   //  TOTAL_ORDER_BOOK_SIZE
            lamports: 101977920,
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    // create asks
    marketInstructions.push(
        SystemProgram.createAccount({
            newAccountPubkey: marketAccounts.asks.publicKey,
            fromPubkey: userKp.publicKey,
            space: 14524,   //  TOTAL_ORDER_BOOK_SIZE
            lamports: 101977920,
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    marketInstructions.push(
        DexInstructions.initializeMarket({
            market: marketAccounts.market.publicKey,
            requestQueue: marketAccounts.requestQueue.publicKey,
            eventQueue: marketAccounts.eventQueue.publicKey,
            bids: marketAccounts.bids.publicKey,
            asks: marketAccounts.asks.publicKey,
            baseVault: marketAccounts.baseVault.publicKey,
            quoteVault: marketAccounts.quoteVault.publicKey,
            baseMint,
            quoteMint,
            baseLotSize: new BN(baseLotSize),
            quoteLotSize: new BN(quoteLotSize),
            feeRateBps: 150, // Unused in v3
            quoteDustThreshold: new BN(500), // Unused in v3
            vaultSignerNonce: vaultOwnerNonce,
            programId: raydiumProgramId.OPENBOOK_MARKET,
        })
    );

    const createVaultTx = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
        ...vaultInstructions
    );
    createVaultTx.recentBlockhash = blockhash;
    createVaultTx.feePayer = userKp.publicKey;
    createVaultTx.sign(
        userKp,
        marketAccounts.baseVault,
        marketAccounts.quoteVault
    );

    const messageV0 = new TransactionMessage({
        payerKey: userKp.publicKey,
        recentBlockhash: blockhash,
        instructions: [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 600_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 20_000 }),
            ...marketInstructions
        ],
    }).compileToV0Message();

    const createMarketTx = new VersionedTransaction(messageV0);

    createMarketTx.sign([
        userKp,
        marketAccounts.market,
        marketAccounts.requestQueue,
        marketAccounts.eventQueue,
        marketAccounts.bids,
        marketAccounts.asks
    ]);

    // await execTx(createVaultTx, connection, userKp, "finalized");
    // await execTx(createMarketTx, connection, userKp, "processed");

    return { market: marketAccounts.market.publicKey, createVaultTx, createMarketTx };
}
