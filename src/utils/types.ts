import { PublicKey } from "@solana/web3.js";
import { Schema, serialize, deserialize } from "borsh";

export type PumpCreateData = {
    name: string;
    symbol: string;
    uri: string;
    mint: PublicKey;
    bondingCurve: PublicKey;
    user: PublicKey;
};

export type PumpMigrateData = {
    // 16 - discriminator
    // 8 - timestamp
    // 2 - index
    // 32 - creator
    baseMint: PublicKey;
    quoteMint: PublicKey;
    // 1 - baseMintDecimals
    // 1 - quoteMintDecimals
    // 8 - baseAmountIn
    // 8 - quoteAmountIn
    // 8 - poolBaseAmount
    // 8 - poolQuoteAmount
    // 8 - minimumLiquidity
    // 8 - initialLiquidity
    // 8 - lpTokenAmountOut
    // 1 - poolBump
    pool: PublicKey;
    // 32 - lpMint
    // 32 - userBaseTokenAccount
    // 32 - userQuoteTOkenAccount
};

export type PumpAmmBuyData = {
    // 16 - discriminator
    // 8 - timestamp
    baseAmountOut: bigint;
    // 8 - maxQuoteAmountIn
    // 8 - userBaseTokenReserves
    // 8 - userQuoteTokenReserves
    poolBaseTokenReserves: bigint;
    poolQuoteTokenReserves: bigint;
    // 8 - quoteAmountIn
    // 8 - lpFeeBasisPoints
    // 8 - lpFee
    // 8 - protocolFeeBasisPoints
    // 8 - protocolFee
    quoteAmountInWithLpFee: bigint;
    // 8 - userQuoteAmountIn
    // 32 - pool
    // 32 - user
    // 32 - userBaseTokenAccount
    // 32 - userQuoteTokenAccount
    // 32 - protocolFeeRecipient
    // 32 - protocolFeeRecipientTokenAccount
    coinCreator: PublicKey;
    //  8 - coinCreatorFeeBasisPoints
    //  8 - coinCreatorFee
};

export type Socials = {
    website?: string;
    twitter?: string;
    telegram?: string;
    // description?: string;
    tweetCreatorUsername?: string;
};
