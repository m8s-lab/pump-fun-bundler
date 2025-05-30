
import { ApiPoolInfoV4, findProgramAddress, jsonInfo2PoolKeys, Liquidity, LIQUIDITY_STATE_LAYOUT_V4, Market, MARKET_STATE_LAYOUT_V3, SPL_MINT_LAYOUT } from "@raydium-io/raydium-sdk";
import { PublicKey, Keypair, TransactionMessage, VersionedTransaction, Blockhash, Connection } from "@solana/web3.js";
import { raydiumProgramId, solanaConnection } from "../core/config/env";
import { getAssociatedTokenAccount } from "../utils/web3";
import { BN } from "@coral-xyz/anchor";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, NATIVE_MINT } from "@solana/spl-token";

export const buildRemoveLiquidityTx = async (
    market: PublicKey,
    userKp: Keypair,

    removePercent: number,
    blockhash: Blockhash,
) => {
    const poolId = findProgramAddress(
        [raydiumProgramId.AmmV4.toBuffer(), market.toBuffer(), Buffer.from('amm_associated_seed', 'utf-8')],
        raydiumProgramId.AmmV4,
    );
    console.log("--------------------");
    console.log("poolId:", poolId.publicKey.toBase58());

    const poolKeys = jsonInfo2PoolKeys(await formatAmmKeysById(solanaConnection, poolId.publicKey.toBase58()));

    console.log("poolKeys:", poolKeys);

    const baseAta = getAssociatedTokenAccount(userKp.publicKey, poolKeys.baseMint);
    const quoteAta = getAssociatedTokenAccount(userKp.publicKey, poolKeys.quoteMint);
    const lpAta = getAssociatedTokenAccount(userKp.publicKey, poolKeys.lpMint);

    const solAta = poolKeys.baseMint.equals(NATIVE_MINT) ? baseAta : quoteAta;

    const lpAmount = Number((await solanaConnection.getTokenAccountBalance(lpAta)).value.amount);
    const amountIn = lpAmount / 100 * removePercent;

    //  create/close WSOL account
    const closePoolIxs = Liquidity.makeRemoveLiquidityInstruction({
        poolKeys,
        userKeys: {
            baseTokenAccount: baseAta,
            quoteTokenAccount: quoteAta,
            lpTokenAccount: lpAta,
            owner: userKp.publicKey,
        },
        amountIn: new BN(amountIn)
    }).innerTransaction;

    if (closePoolIxs.lookupTableAddress && closePoolIxs.lookupTableAddress.length != 0) {
        console.log("lookup table is not empty!");
        console.log(closePoolIxs.lookupTableAddress);
    }

    const messageV0 = new TransactionMessage({
        payerKey: userKp.publicKey,
        recentBlockhash: blockhash,
        instructions: [
            createAssociatedTokenAccountInstruction(
                userKp.publicKey,
                solAta,
                userKp.publicKey,
                NATIVE_MINT
            ),
            ...closePoolIxs.instructions,
            createCloseAccountInstruction(
                solAta,
                userKp.publicKey,
                userKp.publicKey
            )
        ],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([userKp, ...closePoolIxs.signers]);

    return transaction;
}

export const formatAmmKeysById = async (connection: Connection, id: string): Promise<ApiPoolInfoV4> => {
    const account = await connection.getAccountInfo(new PublicKey(id))
    if (account === null) throw Error(' get id info error ')
    const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data)

    const marketId = info.marketId
    const marketAccount = await connection.getAccountInfo(marketId)
    if (marketAccount === null) throw Error(' get market info error')
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data)

    const lpMint = info.lpMint
    const lpMintAccount = await connection.getAccountInfo(lpMint)
    if (lpMintAccount === null) throw Error(' get lp mint info error')
    const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data)

    return {
        id,
        baseMint: info.baseMint.toString(),
        quoteMint: info.quoteMint.toString(),
        lpMint: info.lpMint.toString(),
        baseDecimals: info.baseDecimal.toNumber(),
        quoteDecimals: info.quoteDecimal.toNumber(),
        lpDecimals: lpMintInfo.decimals,
        version: 4,
        programId: account.owner.toString(),
        authority: Liquidity.getAssociatedAuthority({ programId: account.owner }).publicKey.toString(),
        openOrders: info.openOrders.toString(),
        targetOrders: info.targetOrders.toString(),
        baseVault: info.baseVault.toString(),
        quoteVault: info.quoteVault.toString(),
        withdrawQueue: info.withdrawQueue.toString(),
        lpVault: info.lpVault.toString(),
        marketVersion: 3,
        marketProgramId: info.marketProgramId.toString(),
        marketId: info.marketId.toString(),
        marketAuthority: Market.getAssociatedAuthority({ programId: info.marketProgramId, marketId: info.marketId }).publicKey.toString(),
        marketBaseVault: marketInfo.baseVault.toString(),
        marketQuoteVault: marketInfo.quoteVault.toString(),
        marketBids: marketInfo.bids.toString(),
        marketAsks: marketInfo.asks.toString(),
        marketEventQueue: marketInfo.eventQueue.toString(),
        lookupTableAccount: PublicKey.default.toString()
    }
}
