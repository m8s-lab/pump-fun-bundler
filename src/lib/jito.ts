import { Blockhash, Commitment, Keypair, PublicKey, SystemProgram, Transaction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import base58 from "bs58";
import axios from "axios";
import { logLogger } from "../utils/logger";
import { JITO_FEE } from "../core/config/env";

export const executeJitoTx = async (transactions: VersionedTransaction[], commitment: Commitment, latestBlockhash: any) => {

    try {
        const jitoTxsignature = base58.encode(transactions[0].signatures[0]);

        // Serialize the transactions once here
        const serializedTransactions: string[] = [];
        for (let i = 0; i < transactions.length; i++) {
            serializedTransactions.push(base58.encode(transactions[i].serialize()));
        }

        const endpoints = [
            // 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
            'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
            'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
            'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
            'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
        ];

        const requests = endpoints.map((url) =>
            axios.post(url, {
                jsonrpc: '2.0',
                id: 1,
                method: 'sendBundle',
                params: [serializedTransactions],
            })
        );

        // console.log('Sending transactions to endpoints...');

        const results = await Promise.all(requests.map((p) => p.catch((e) => e)));

        const successfulResults = results.filter((result) => !(result instanceof Error));

        if (successfulResults.length > 0) {
            logLogger.log("tx:", jitoTxsignature);
            // console.log(`Successful response`);
            // console.log(`Confirming jito transaction...`);

            // console.log("successfulResults.length====>", successfulResults.length);

            // const confirmation = await solanaConnection.confirmTransaction(
            //     {
            //         signature: jitoTxsignature,
            //         lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            //         blockhash: latestBlockhash.blockhash,
            //     },
            //     commitment,
            // );
            // console.log("🚀 ~ executeJitoTx ~ confirmation:", confirmation)

            // if (confirmation.value.err) {
            //     console.log("Confirmtaion error")
            //     return null
            // } else {
            // return jitoTxsignature;
            // }
        } else {
            logLogger.log("successfulResults.length====>", successfulResults.length);
            logLogger.log(`No successful responses received for jito`);
        }
        return null
    } catch (error) {
        logLogger.log('Error during transaction execution', error as string);
        return null
    }
}

export const buildJitoTipIx = (fromPubkey: PublicKey) => {
    //  add jito tip instruction
    const tipAccounts = [
        'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
        'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
        '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
        '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
        'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
        'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
        'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
        'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
    ];
    const jitoFeeWallet = new PublicKey(tipAccounts[Math.floor(tipAccounts.length * Math.random())]);

    return SystemProgram.transfer({
        fromPubkey,
        toPubkey: jitoFeeWallet,
        lamports: Math.floor(JITO_FEE),
    });
}

export const buildJitoTipTx = (userKp: Keypair, blockhash: Blockhash) => {
    const messageV0 = new TransactionMessage({
        payerKey: userKp.publicKey,
        recentBlockhash: blockhash,
        instructions: [
            buildJitoTipIx(userKp.publicKey)
        ],
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([userKp]);

    return tx;
}
