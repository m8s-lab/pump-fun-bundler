import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { execTx, getAssociatedTokenAccount } from "../../utils/web3";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createSyncNativeInstruction, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PumpSwapSDK } from "./pumpswap";
import { solanaConnection, userKp } from "../../core/config/env";
import { BN } from "@coral-xyz/anchor";

export const sellTokenPumpswap = async (
    baseMint: PublicKey,
    quoteMint: PublicKey,
    pool: PublicKey,
    coinCreator: PublicKey,

    sellPercent: number,

    keypair: Keypair,
    connection: Connection,
    priorityFee: number = 30_000
) => {
    if (sellPercent > 100) return;

    try {
        const pumpswapSdk = new PumpSwapSDK(solanaConnection);

        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, keypair.publicKey);
        const quoteBaseTokenAccount = getAssociatedTokenAddressSync(quoteMint, keypair.publicKey);

        const tokenBalance = await connection.getTokenAccountBalance(userBaseTokenAccount, "processed");

        const amount = sellPercent == 100 ?
            new BN(tokenBalance.value.amount) :
            new BN(tokenBalance.value.amount).mul(new BN(sellPercent)).div(new BN(100));

        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 180_000 })
        ).add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
        ).add(
            createAssociatedTokenAccountInstruction(
                userKp.publicKey,
                quoteBaseTokenAccount,
                userKp.publicKey,
                NATIVE_MINT
            )
        ).add(
            await pumpswapSdk.getSellInstruction(
                amount,
                new BN(0), {
                baseMint,
                quoteMint,
                pool,
                baseTokenProgram: TOKEN_PROGRAM_ID,
                quoteTokenProgram: TOKEN_PROGRAM_ID,
                user: keypair.publicKey,
                coinCreator
            })
        ).add(
            createCloseAccountInstruction(
                quoteBaseTokenAccount,
                userKp.publicKey,
                userKp.publicKey
            )
        );
        if (sellPercent == 100) {
            transaction.add(
                createCloseAccountInstruction(userBaseTokenAccount, keypair.publicKey, keypair.publicKey)
            );
        }

        const latestBlockhash = await connection.getLatestBlockhash();

        transaction.feePayer = keypair.publicKey;
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.sign(keypair);

        await execTx(transaction, connection, "processed");
    } catch (e) {
        // errorLogger.error("can not sell token, e:", e as string);
        console.log("can not sell token, e:", e as string);
    }
}
