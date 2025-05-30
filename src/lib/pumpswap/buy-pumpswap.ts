import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { execTx, getAssociatedTokenAccount } from "../../utils/web3";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PumpSwapSDK } from "./pumpswap";
import { solanaConnection, userKp } from "../../core/config/env";
import { BN } from "@coral-xyz/anchor";

export const buyTokenPumpswap = async (
    pool: PublicKey,
    baseMint: PublicKey,

    baseAmountOut: BN,
    maxQuoteAmountIn: BN,

    coinCreator: PublicKey,

    keypair: Keypair,
    connection: Connection,
    priorityFee: number = 100_000
) => {

    try {
        const pumpswapSdk = new PumpSwapSDK(solanaConnection);

        const baseTokenAccount = getAssociatedTokenAddressSync(baseMint, keypair.publicKey);
        const quoteTokenAccount = getAssociatedTokenAddressSync(NATIVE_MINT, keypair.publicKey);

        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
        ).add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
        ).add(      //  Create WSOL account
            createAssociatedTokenAccountInstruction(
                userKp.publicKey,
                quoteTokenAccount,
                userKp.publicKey,
                NATIVE_MINT
            )
        ).add(      //  transfer SOL to WSOL account
            SystemProgram.transfer({
                fromPubkey: userKp.publicKey,
                toPubkey: quoteTokenAccount,
                lamports: maxQuoteAmountIn
            })
        ).add(      //  sync WSOL account
            createSyncNativeInstruction(quoteTokenAccount)
        ).add(      //  Create Token Account
            createAssociatedTokenAccountInstruction(
                userKp.publicKey,
                baseTokenAccount,
                userKp.publicKey,
                baseMint
            )
        ).add(
            await pumpswapSdk.getBuyInstruction(
                baseAmountOut,
                maxQuoteAmountIn,
                {
                    baseMint,
                    baseTokenProgram: TOKEN_PROGRAM_ID,
                    pool,
                    quoteMint: NATIVE_MINT,
                    quoteTokenProgram: TOKEN_PROGRAM_ID,
                    user: keypair.publicKey,
                    coinCreator
                }
            )
        ).add(      //  Close WSOL account
            createCloseAccountInstruction(
                quoteTokenAccount,
                userKp.publicKey,
                userKp.publicKey
            )
        );

        const latestBlockhash = await connection.getLatestBlockhash();

        transaction.feePayer = keypair.publicKey;
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.sign(keypair);

        await execTx(transaction, connection, "processed");
    } catch (e) {
        throw ("can not buy token in pumpAmm, e:");
    }
}
