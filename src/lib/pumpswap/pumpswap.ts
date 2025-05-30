import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { clusterApiUrl, Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PumpSwap, PumpSwapIDL } from "../../idl";
import { GLOBAL_CONFIG_SEED, LP_MINT_SEED, POOL_SEED, PROTOCOL_FEE_RECIPIENT } from "./constants";
import { CreatePoolType, DepositType, TradeType, WithdrawType } from "./types";

export class PumpSwapSDK {
    private program: Program<PumpSwap>;

    /**
     * 
     * @param connection Connection
     */
    constructor(
        connection: Connection
    ) {
        const wallet = new NodeWallet(Keypair.generate());
        const provider = new AnchorProvider(connection, wallet, { commitment: connection.commitment });
        this.program = new Program(PumpSwapIDL as PumpSwap, provider);
    }

    /**
     * 
     * @param lpFeeBasisPoints BN
     * @param protocolFeeBasisPoints BN
     * @param protocolFeeRecipients Array<PublicKey>
     * @returns Promise<TransactionInstruction>
     */
    getCreateConfigInstruction = async (
        lpFeeBasisPoints: BN,
        protocolFeeBasisPoints: BN,
        protocolFeeRecipients: Array<PublicKey>,
        coinCreatorFeeBasisPoints: BN
    ): Promise<TransactionInstruction> => {
        const ix = await this.program.methods
            .createConfig(
                lpFeeBasisPoints,
                protocolFeeBasisPoints,
                protocolFeeRecipients,
                coinCreatorFeeBasisPoints
            )
            .accounts({
                program: this.program.programId
            })
            .instruction()
        return ix
    }

    /**
     * 
     * @param baseAmountOut BN
     * @param maxQuoteAmountIn BN
     * @param tradeParam TradeType
     * @returns Promise<TransactionInstruction>
     */
    getBuyInstruction = async (
        baseAmountOut: BN,
        maxQuoteAmountIn: BN,
        tradeParam: TradeType
    ): Promise<TransactionInstruction> => {
        const {
            baseMint,
            baseTokenProgram,
            pool,
            quoteMint,
            quoteTokenProgram,
            user,
            coinCreator
        } = tradeParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId);
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user);
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user);

        const poolBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, pool, true);
        const poolQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, pool, true);

        const [coinCreatorVaultAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from("creator_vault"), coinCreator.toBuffer()],
            this.program.programId,
        );
        const coinCreatorVaultAta = getAssociatedTokenAddressSync(quoteMint, coinCreatorVaultAuthority, true);

        const ix = await this.program.methods
            .buy(baseAmountOut, maxQuoteAmountIn)
            .accountsPartial({
                pool,
                globalConfig,
                user: user,
                baseMint,
                quoteMint,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                poolBaseTokenAccount,
                poolQuoteTokenAccount,
                protocolFeeRecipient: PROTOCOL_FEE_RECIPIENT,
                baseTokenProgram,
                quoteTokenProgram,
                program: this.program.programId,
                coinCreatorVaultAta,
                coinCreatorVaultAuthority
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param baseAmountIn BN
     * @param minQuoteAmountOut BN
     * @param tradeParam TradeType
     * @returns Promise<TransactionInstruction>
     */
    getSellInstruction = async (
        baseAmountIn: BN,
        minQuoteAmountOut: BN,
        tradeParam: TradeType
    ): Promise<TransactionInstruction> => {
        const {
            baseMint,
            baseTokenProgram,
            pool,
            quoteMint,
            quoteTokenProgram,
            user
        } = tradeParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods
            .sell(baseAmountIn, minQuoteAmountOut)
            .accounts({
                pool,
                globalConfig: globalConfig,
                program: this.program.programId,
                protocolFeeRecipient: PROTOCOL_FEE_RECIPIENT,
                baseTokenProgram,
                quoteTokenProgram,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                user: user
            })
            .instruction()
        return ix
    }

    /**
     * 
     * @param index number
     * @param baseAmountIn BN
     * @param quoteAmountIn BN
     * @param createPoolParam CreatePoolType
     * @param user PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getCreatePoolInstruction = async (
        index: number,
        baseAmountIn: BN,
        quoteAmountIn: BN,
        createPoolParam: CreatePoolType,
        user: PublicKey,
        coinCreatorFeeBasisPoints: BN
    ): Promise<TransactionInstruction> => {
        const {
            creator,
            baseMint,
            quoteMint,
            baseTokenProgram,
            quoteTokenProgram
        } = createPoolParam
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods.createPool(index, baseAmountIn, quoteAmountIn, coinCreatorFeeBasisPoints).accounts({
            globalConfig: globalConfig,
            baseMint,
            quoteMint,
            userBaseTokenAccount,
            userQuoteTokenAccount,
            baseTokenProgram,
            quoteTokenProgram,
            creator,
            program: this.program.programId,
        })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpTokenAmountOut BN
     * @param maxBaseAmountIn BN
     * @param maxQuoteAmountIn BN
     * @param depositType DepositType
     * @returns Promise<TransactionInstruction>
     */
    getDepositInstruction = async (
        lpTokenAmountOut: BN,
        maxBaseAmountIn: BN,
        maxQuoteAmountIn: BN,
        depositType: DepositType
    ): Promise<TransactionInstruction> => {
        const { baseMint, pool, quoteMint, user } = depositType
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const [lpMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
            this.program.programId
        );
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const userPoolTokenAccount = getAssociatedTokenAddressSync(lpMint, user)
        const ix = await this.program.methods.deposit(lpTokenAmountOut, maxBaseAmountIn, maxQuoteAmountIn).accounts({
            globalConfig: globalConfig,
            pool,
            program: this.program.programId,
            userPoolTokenAccount,
            userBaseTokenAccount,
            userQuoteTokenAccount,
            user: user
        })
            .instruction()

        return ix
    }

    /**
     * 
     * @param disableCreatePool boolean
     * @param disableDeposit boolean
     * @param disableWithdraw boolean
     * @param disableBuy boolean
     * @param disableSell boolean
     * @returns Promise<TransactionInstruction>
     */
    getDisableInstruction = async (
        disableCreatePool: boolean,
        disableDeposit: boolean,
        disableWithdraw: boolean,
        disableBuy: boolean,
        disableSell: boolean
    ): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)

        const ix = await this.program.methods
            .disable(disableCreatePool, disableDeposit, disableWithdraw, disableBuy, disableSell)
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param account PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getExtendAccountInstruction = async (account: PublicKey): Promise<TransactionInstruction> => {
        const ix = await this.program.methods
            .extendAccount()
            .accounts({
                account: account,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param newAdmin PublicKey
     * @returns Promise<TransactionInstruction>
     */
    getUpdateAdminInstruction = async (newAdmin: PublicKey): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const ix = await this.program.methods
            .updateAdmin()
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId,
                newAdmin: newAdmin
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpFeeBasisPoints BN
     * @param protocolFeeBasisPoints BN
     * @param protocolFeeRecipients Array<PublicKey>
     * @returns Promise<TransactionInstruction>
     */
    getUpdateFeeConfigInstruction = async (
        lpFeeBasisPoints: BN,
        protocolFeeBasisPoints: BN,
        protocolFeeRecipients: Array<PublicKey>,
        coinCreatorFeeBasisPoints: BN
    ): Promise<TransactionInstruction> => {
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const ix = await this.program.methods
            .updateFeeConfig(lpFeeBasisPoints, protocolFeeBasisPoints, protocolFeeRecipients, coinCreatorFeeBasisPoints)
            .accounts({
                globalConfig: globalConfig,
                program: this.program.programId
            })
            .instruction()

        return ix
    }

    /**
     * 
     * @param lpTokenAmountIn BN
     * @param minBaseAmountOut BN
     * @param minQuoteAmountOut BN
     * @param withdrawParam WithdrawType
     * @returns Promise<TransactionInstruction>
     */
    getWithdrawInstruction = async (
        lpTokenAmountIn: BN,
        minBaseAmountOut: BN,
        minQuoteAmountOut: BN,
        withdrawParam: WithdrawType
    ): Promise<TransactionInstruction> => {
        const { baseMint, creator, index, quoteMint, user } = withdrawParam

        const [pool] = PublicKey.findProgramAddressSync([
            Buffer.from(POOL_SEED),
            new BN(index).toArrayLike(Buffer, "le", 8),
            creator.toBuffer(),
            baseMint.toBuffer(),
            quoteMint.toBuffer(),
        ], this.program.programId);
        const [lpMint] = PublicKey.findProgramAddressSync(
            [Buffer.from(LP_MINT_SEED), pool.toBuffer()],
            this.program.programId
        );
        const [userPoolTokenAccount] = PublicKey.findProgramAddressSync(
            [creator.toBuffer(), TOKEN_2022_PROGRAM_ID.toBuffer(), lpMint.toBuffer()],
            this.program.programId
        );
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(GLOBAL_CONFIG_SEED)], this.program.programId)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)
        const ix = await this.program.methods
            .withdraw(lpTokenAmountIn, minBaseAmountOut, minQuoteAmountOut)
            .accounts({
                pool,
                globalConfig: globalConfig,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                userPoolTokenAccount,
                program: this.program.programId,
                user: user
            })
            .instruction()

        return ix
    }
}

export default PumpSwapSDK