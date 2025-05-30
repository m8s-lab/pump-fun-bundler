import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { PUMP_FUN } from "../../core/constants";
import { execTx, getAssociatedTokenAccount } from "../../utils/web3";
import { createCloseAccountInstruction } from "@solana/spl-token";
import { PumpFunSDK } from "./pumpfun";
import { solanaConnection, userKp } from "../../core/config/env";
import { BN } from "@coral-xyz/anchor";

export const sellTokens = async (
    tokens: { mint: PublicKey, amount: BN }[],
    keypair: Keypair,
    connection: Connection,
    priorityFee: number = 30_000
) => {
    const provider = new anchor.AnchorProvider(solanaConnection, new anchor.Wallet(userKp), {
        commitment: "processed",
    });
    const pumpfunSdk = new PumpFunSDK(provider);

    const transaction = new Transaction().add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: 180_000 })
    ).add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
    );

    for (const token of tokens) {
        //  get user ATA
        const associatedUser = getAssociatedTokenAccount(keypair.publicKey, token.mint);

        transaction.add(
            await pumpfunSdk.program.methods.sell(
                token.amount, new anchor.BN(0)
            ).accountsPartial({
                user: keypair.publicKey,
                mint: token.mint,
                associatedUser: associatedUser,
                feeRecipient: PUMP_FUN.FEE_RECEIPT,
            }).instruction()
        ).add(
            createCloseAccountInstruction(associatedUser, keypair.publicKey, keypair.publicKey)
        );
    }

    const latestBlockhash = await connection.getLatestBlockhash();

    transaction.feePayer = keypair.publicKey;
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.sign(keypair);

    await execTx(transaction, connection, "processed");

}
