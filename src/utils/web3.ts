import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { PUMP_FUN } from "../core/constants";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

export const getAssociatedTokenAccount = (ownerPubkey: PublicKey, mintPk: PublicKey): PublicKey => {
    return PublicKey.findProgramAddressSync(
        [
            ownerPubkey.toBytes(),
            TOKEN_PROGRAM_ID.toBytes(),
            mintPk.toBytes(), // mint address
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
}

export const getBondingCurvePDA = (mint: PublicKey): PublicKey => {
    const BONDING_CURVE_SEED = "bonding-curve";

    return PublicKey.findProgramAddressSync(
        [
            Buffer.from(BONDING_CURVE_SEED),
            mint.toBuffer()
        ],
        new PublicKey(PUMP_FUN.PROGRAM_ID)
    )[0];
}

export const execTx = async (
    transaction: Transaction | VersionedTransaction,
    connection: Connection,
    commitment: "processed" | "confirmed" | "finalized" = 'confirmed'
) => {
    try {
        // Serialize, send and confirm the transaction
        const rawTransaction = transaction.serialize()

        const txid = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true,
            maxRetries: 2,
            preflightCommitment: "processed"
        });
        console.log(`https://solscan.io/tx/${txid}?cluster=custom&customUrl=${connection.rpcEndpoint}`);

        const confirmed = await connection.confirmTransaction(txid, commitment);

        console.log("err ", confirmed.value.err)
    } catch (e) {
        console.log(e);
    }
}

export const execAllTx = async (
    transaction: (Transaction | VersionedTransaction)[],
    connection: Connection,
    commitment: "processed" | "confirmed" | "finalized" = 'confirmed'
) => {
    try {
        const rawTransactions = transaction.map((tx) => {
            // Serialize, send and confirm the transaction
            return tx.serialize();
        });

        const txHashes = await Promise.all(
            rawTransactions.map(async (rawTx) => {
                const txid = await connection.sendRawTransaction(rawTx, {
                    skipPreflight: true,
                    maxRetries: 2,
                    preflightCommitment: "processed"
                });
                console.log(`https://solscan.io/tx/${txid}?cluster=custom&customUrl=${connection.rpcEndpoint}`);

                return txid;
            }));

        // const confirmed = await connection.confirmTransaction(txid, commitment);

        // console.log("err ", confirmed.value.err)
    } catch (e) {
        console.log(e);
    }
}

export const findInstructionWithDiscriminator = (array: any[], discriminator: Buffer) => {
    for (const item of array) {
        const found = item.instructions.find(
            (instruction: any) =>
                instruction.data.slice(0, discriminator.length).compare(discriminator) === 0
        );
        if (found) {
            return found;
        }
    }
    return null;
};
