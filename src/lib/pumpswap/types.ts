import { PublicKey } from "@solana/web3.js";

interface CreatePoolType {
    baseMint: PublicKey,
    quoteMint: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    creator: PublicKey,
}


interface TradeType {
    baseMint: PublicKey,
    quoteMint: PublicKey,
    pool: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    user: PublicKey,
    coinCreator: PublicKey
}

interface WithdrawType {
    index: number,
    creator: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    user: PublicKey,
}

interface DepositType {
    pool: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    user: PublicKey,
}

export {
    TradeType,
    CreatePoolType,
    WithdrawType,
    DepositType
}