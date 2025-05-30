import {
    Commitment,
    Connection,
    Finality,
    Keypair,
    PublicKey,
    Transaction,
} from "@solana/web3.js";
import { BN, Program, Provider } from "@coral-xyz/anchor";
import {
    createAssociatedTokenAccountInstruction,
    getAccount,
} from "@solana/spl-token";
import { TransactionInstruction } from "@solana/web3.js";
import { PumpFun, PumpFunIDL } from "../../idl/index"
import { PumpAmmBuyData, PumpCreateData, PumpMigrateData } from "../../utils/types";
import { getAssociatedTokenAccount } from "../../utils/web3";
import { BondingCurveAccount } from "./bondingCurveAccount";
import { GlobalAccount } from "./globalAccount";
import { PUMP_FUN } from "../../core/constants";

const PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const MPL_TOKEN_METADATA_PROGRAM_ID = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";

export const GLOBAL_ACCOUNT_SEED = "global";
export const MINT_AUTHORITY_SEED = "mint-authority";
export const BONDING_CURVE_SEED = "bonding-curve";
export const METADATA_SEED = "metadata";

export const DEFAULT_DECIMALS = 6;

export class PumpFunSDK {
    public program: Program<PumpFun>;
    public connection: Connection;
    constructor(provider?: Provider) {
        this.program = new Program<PumpFun>(PumpFunIDL as PumpFun, provider);
        this.connection = this.program.provider.connection;
    }

    getBondingCurvePDA = (mint: PublicKey): PublicKey => {
        return PublicKey.findProgramAddressSync(
            [Buffer.from(BONDING_CURVE_SEED), mint.toBuffer()],
            this.program.programId
        )[0];
    };
    getBondingCurveAccount = async (mint: PublicKey, commitment?: Commitment) => {
        const tokenAccount = await this.connection.getAccountInfo(
            this.getBondingCurvePDA(mint),
            commitment
        );
        if (!tokenAccount) {
            return null;
        }
        return BondingCurveAccount.fromBuffer(tokenAccount!.data);
    }

    calculateWithSlippageBuy = (
        amount: bigint,
        basisPoints: bigint
    ) => {
        return amount + (amount * basisPoints) / BigInt(1000);
    };

    getGlobalAccount = async (commitment?: Commitment) => {
        const [globalAccountPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from(GLOBAL_ACCOUNT_SEED)],
            new PublicKey(PROGRAM_ID)
        );

        const tokenAccount = await this.connection.getAccountInfo(
            globalAccountPDA,
            commitment
        );

        return GlobalAccount.fromBuffer(tokenAccount!.data);
    }

    getBuyIxsBySolAmount = async (
        buyer: PublicKey,
        mint: PublicKey,
        buyAmountSol: bigint,
        slippageBasisPoints: bigint = BigInt(500),
        commitment?: Commitment
    ) => {
        const bondingCurveAccount = await this.getBondingCurveAccount(
            mint,
            commitment
        );
        if (!bondingCurveAccount) {
            throw new Error(`Bonding curve account not found: ${mint.toBase58()}`);
        }

        const buyAmount = bondingCurveAccount.getBuyPrice(buyAmountSol);
        const buyAmountWithSlippage = this.calculateWithSlippageBuy(
            buyAmountSol,
            slippageBasisPoints
        );
        // const globalAccount = await this.getGlobalAccount(commitment);

        return await this.getBuyIxs(
            buyer,
            mint,
            // globalAccount.feeRecipient,
            PUMP_FUN.FEE_RECEIPT,
            buyAmount,
            buyAmountWithSlippage,
        );
    }

    //buy
    getBuyIxs = async (
        buyer: PublicKey,
        mint: PublicKey,
        feeRecipient: PublicKey,
        amount: bigint,
        solAmount: bigint,
    ) => {
        const associatedUser = getAssociatedTokenAccount(buyer, mint);

        const ixs: TransactionInstruction[] = [];

        // try {
        // await getAccount(this.connection, associatedUser, commitment);
        // } catch (e) {
        ixs.push(
            createAssociatedTokenAccountInstruction(
                buyer,
                associatedUser,
                buyer,
                mint
            )
        );
        // }

        ixs.push(
            await this.program.methods
                .buy(new BN(amount.toString()), new BN(solAmount.toString()))
                .accountsPartial({
                    user: buyer,
                    mint: mint,
                    associatedUser: associatedUser,
                    feeRecipient: feeRecipient
                })
                .instruction()
        );

        return ixs;
    }

    parseCreateCpiLog = (buffer: Buffer): PumpCreateData => {
        let offset = 16;    //  skip first 16 bytes

        // Helper function to read a string (assuming it's prefixed with a 4-byte length)
        const readString = (): string => {
            const length = buffer.readUInt32LE(offset); // 4 bytes for length
            offset += 4;
            const value = buffer.toString('utf-8', offset, offset + length);
            offset += length;
            return value;
        }

        // Helper function to read a PublicKey (assuming it's 32 bytes)
        const readPublicKey = (): PublicKey => {
            const publicKey = new PublicKey(buffer.subarray(offset, offset + 32));
            offset += 32;
            return publicKey;
        }

        // Parse the buffer and populate the CpiLog
        const name = readString();
        const symbol = readString();
        const uri = readString();
        const mint = readPublicKey();
        const bondingCurve = readPublicKey();
        const user = readPublicKey();

        return { name, symbol, uri, mint, bondingCurve, user };
    }

    parseMigrateCpiLog = (buffer: Buffer): PumpMigrateData => {
        let offset = 16 + 10;   //  discriminator + timestamp + index

        // Helper function to read a PublicKey (assuming it's 32 bytes)
        const readPublicKey = (): PublicKey => {
            const publicKey = new PublicKey(buffer.subarray(offset, offset + 32));
            offset += 32;
            return publicKey;
        }

        readPublicKey();    //  creator
        const baseMint = readPublicKey();
        const quoteMint = readPublicKey();
        offset += 59;
        const pool = readPublicKey();

        return { baseMint, quoteMint, pool };
    }

    parseBuyCpiLog = (buffer: Buffer): PumpAmmBuyData => {
        let offset = 16 + 8;   //  discriminator + timestamp

        const baseAmountOut = buffer.readBigUInt64LE(offset);
        offset += 8 + 24;

        const poolBaseTokenReserves = buffer.readBigUInt64LE(offset);
        const poolQuoteTokenReserves = buffer.readBigUInt64LE(offset + 8);
        offset += 16 + 40;

        const quoteAmountInWithLpFee = buffer.readBigUInt64LE(offset);

        // Helper function to read a PublicKey (assuming it's 32 bytes)
        const readPublicKey = (): PublicKey => {
            const publicKey = new PublicKey(buffer.subarray(offset, offset + 32));
            offset += 32;
            return publicKey;
        }

        offset += 16 + 32 * 6;
        const coinCreator = readPublicKey();

        return { baseAmountOut, poolBaseTokenReserves, poolQuoteTokenReserves, quoteAmountInWithLpFee, coinCreator };
    }
}


