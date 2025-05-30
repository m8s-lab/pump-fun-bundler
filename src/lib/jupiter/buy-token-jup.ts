import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { execTx } from "../../utils/web3";

export const buyTokenJup = async (
    mint: PublicKey,
    buyAmount: number,
    keypair: Keypair,
    connection: Connection,
) => {
    try {
        const quoteResponse = await (
            await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${NATIVE_MINT.toBase58()}&outputMint=${mint.toBase58()}&amount=${buyAmount}&slippageBps=${500}`
            )
        ).json();

        const { swapTransaction } = await (
            await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: keypair.publicKey.toBase58(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: "auto"
                }),
            })
        ).json();

        const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
        const swapTx = VersionedTransaction.deserialize(swapTransactionBuf);

        swapTx.sign([keypair]);
        // const latestBlockhash = await connection.getLatestBlockhash();

        // await executeJitoTx([swapTx], 'processed', latestBlockhash);
        await execTx(swapTx, connection, "processed");

        return true;
    } catch (error) {
        throw (error);
    }
}
