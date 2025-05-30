import { Connection, Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { execTx, getAssociatedTokenAccount } from "../../utils/web3";

export const sellTokenJup = async (
    mint: PublicKey,
    keypair: Keypair,
    connection: Connection,
    sellPercent: number = 70,
) => {
    try {
        const tokenAccount = getAssociatedTokenAccount(keypair.publicKey, mint);
        const balance = await connection.getTokenAccountBalance(tokenAccount);
        const sellAmount = Number(balance.value.amount) / 100 * sellPercent;
        console.log('sell amount:', sellAmount);

        const quoteResponse = await (
            await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${mint.toBase58()}&outputMint=${NATIVE_MINT.toBase58()}&amount=${sellAmount}&slippageBps=${500}`
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
        // logLogger.log(error as string);
        // return false;
        throw (error);
    }
}
