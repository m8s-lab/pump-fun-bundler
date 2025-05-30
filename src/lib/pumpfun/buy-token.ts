import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { PumpFunSDK } from "./pumpfun";
import { BUY_SOL_AMOUNT, solanaConnection, userKp } from "../../core/config/env";
import { buildJitoTipIx, executeJitoTx } from "../jito";
import { logLogger } from "../../utils/logger";

export const buyToken = async (
    mint: PublicKey,
    keypair: Keypair,
    connection: Connection,
    priorityFee: number = 700_000
) => {
    try {
        const provider = new anchor.AnchorProvider(solanaConnection, new anchor.Wallet(userKp), {
            commitment: "processed",
        });
        const pumpfunSdk = new PumpFunSDK(provider);

        const transaction = new Transaction().add(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 76_000 })
        ).add(
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee })
        );

        const buyIxs = await pumpfunSdk.getBuyIxsBySolAmount(
            keypair.publicKey,
            mint,
            BigInt(BUY_SOL_AMOUNT),
            BigInt(500),
            "confirmed"
        );
        buyIxs.map((ix) => transaction.add(ix));

        transaction.add(
            buildJitoTipIx(userKp.publicKey)
        );

        const latestBlockhash = await connection.getLatestBlockhash();

        const messageV0 = new TransactionMessage({
            payerKey: keypair.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: transaction.instructions,
        }).compileToV0Message();

        const versionedTx = new VersionedTransaction(messageV0);
        versionedTx.sign([keypair]);

        await executeJitoTx([versionedTx], 'processed', latestBlockhash);
        // await execTx(versionedTx, connection, "processed");

        return true;
    } catch (error) {
        logLogger.log(error as string);
        return false;
    }
}
