
import { Liquidity } from "@raydium-io/raydium-sdk";
import { PublicKey, Keypair, TransactionInstruction, SystemProgram, TransactionMessage, VersionedTransaction, Blockhash, ComputeBudgetProgram } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, createCloseAccountInstruction, createSyncNativeInstruction, NATIVE_MINT } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { feeDestination, raydiumProgramId } from "../core/config/env";
import { getAssociatedTokenAccount } from "../utils/web3";

export const buildCreatePoolTx = (
    market: PublicKey,
    userKp: Keypair,

    baseMint: PublicKey,
    baseDecimals: number,
    baseAmount: number,

    quoteMint: PublicKey,
    quoteDecimals: number,
    quoteAmount: number,

    blockhash: Blockhash,
    skipWsolCreate: boolean = false
) => {
    const poolInfo = Liquidity.getAssociatedPoolKeys({
        version: 4,
        marketVersion: 3,
        marketId: market,
        baseMint: baseMint,
        quoteMint: quoteMint,
        baseDecimals: baseDecimals,
        quoteDecimals: quoteDecimals,
        programId: raydiumProgramId.AmmV4,
        marketProgramId: raydiumProgramId.OPENBOOK_MARKET,
    });

    const userCoinVault = getAssociatedTokenAccount(userKp.publicKey, poolInfo.baseMint);
    const userPcVault = getAssociatedTokenAccount(userKp.publicKey, poolInfo.quoteMint);

    //  create and send WSOL
    const {solAmount, solVault} = baseMint.equals(NATIVE_MINT) ? {
        solAmount: baseAmount,
        solVault: userCoinVault
    } : quoteMint == NATIVE_MINT ? {
        solAmount: quoteAmount,
        solVault: userPcVault
    } : {
        solAmount: 0,
        solVault: PublicKey.default
    };

    const ixs: TransactionInstruction[] = []

    ixs.push(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 })
    );

    if (solAmount != 0) {
        //  create WSOL account if needed
        if (skipWsolCreate) {
            ixs.push(
                createAssociatedTokenAccountInstruction(
                    userKp.publicKey,
                    solVault,
                    userKp.publicKey,
                    NATIVE_MINT
                )
            )
        }

        ixs.push(
            //  transfer SOL to WSOL account
            SystemProgram.transfer({
                fromPubkey: userKp.publicKey,
                toPubkey: solVault,
                lamports: solAmount
            }),
            //  sync WSOL account
            createSyncNativeInstruction(solVault)
        )
    }

    const createPoolIxs = Liquidity.makeCreatePoolV4InstructionV2({
        programId: raydiumProgramId.AmmV4,
        ammId: poolInfo.id,
        ammAuthority: poolInfo.authority,
        ammOpenOrders: poolInfo.openOrders,
        lpMint: poolInfo.lpMint,
        coinMint: poolInfo.baseMint,
        pcMint: poolInfo.quoteMint,
        coinVault: poolInfo.baseVault,
        pcVault: poolInfo.quoteVault,
        ammTargetOrders: poolInfo.targetOrders,
        marketProgramId: poolInfo.marketProgramId,
        marketId: poolInfo.marketId,
        userWallet: userKp.publicKey,
        userCoinVault,
        userPcVault,
        userLpVault: getAssociatedTokenAccount(userKp.publicKey, poolInfo.lpMint),
        ammConfigId: poolInfo.configId,
        feeDestinationId: feeDestination,

        nonce: poolInfo.nonce,
        openTime: new BN(0),    //  just open it
        coinAmount: new BN(baseAmount),
        pcAmount: new BN(quoteAmount),
    }).innerTransaction;

    ixs.push(...createPoolIxs.instructions,);
    if (skipWsolCreate) {
        //  close WSOL account if needed
        ixs.push(
            createCloseAccountInstruction(
                solVault,
                userKp.publicKey,
                userKp.publicKey
            )
        );
    }

    if (createPoolIxs.lookupTableAddress && createPoolIxs.lookupTableAddress.length != 0) {
        console.log("lookup table is not empty!");
        console.log(createPoolIxs.lookupTableAddress);
    }

    const messageV0 = new TransactionMessage({
        payerKey: userKp.publicKey,
        recentBlockhash: blockhash,
        instructions: ixs,
    }).compileToV0Message();
    
    const transaction = new VersionedTransaction(messageV0);
    transaction.sign([userKp, ...createPoolIxs.signers]);

    return transaction;
}
