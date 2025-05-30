import { PublicKey } from "@solana/web3.js";
import BoughtModel from '../models/boughtModel'
import AmmBoughtModel from '../models/ammBoughtModel'

import { infoLogger, logLogger } from "../utils/logger";
import { PumpMigrateData } from "../utils/types";
import { NATIVE_MINT } from "@solana/spl-token";
import { sellTokenPumpswap } from "../lib/pumpswap/sell-pumpswap";
import { PUMPAMM_BUY_AMOUNT, solanaConnection, userKp } from "../core/config/env";
import { buyTokenPumpswap } from "../lib/pumpswap/buy-pumpswap";
import { BN } from "@coral-xyz/anchor";

export const handleMigrate = async (migrateData: PumpMigrateData, tx: string, solReserve: bigint, tokenReserve: bigint, coinCreator: PublicKey, hasTarget: boolean) => {
    const mint = migrateData.baseMint.equals(NATIVE_MINT) ? migrateData.quoteMint : migrateData.baseMint;

    logLogger.log("================================");
    logLogger.log(`migrate, mint: ${mint.toBase58()}, tx: ${tx}`);

    ////  buy this token
    if (solReserve != BigInt(0) && tokenReserve != BigInt(0)) {
        if (solReserve >= BigInt(370000000000) && hasTarget) {
            logLogger.log(`solReserve: ${solReserve}, tokenReserve: ${tokenReserve}`);

            //  get buy token amount
            let n = solReserve * tokenReserve;
            let i = solReserve + (BigInt(PUMPAMM_BUY_AMOUNT) * BigInt(100) / BigInt(101));
            let r = n / i + 1n;
            let baseAmountOut = tokenReserve - r;

            try {
                infoLogger.log("buy token:", mint.toBase58());

                //  buy token
                await buyTokenPumpswap(
                    migrateData.pool,
                    mint,
                    new BN(baseAmountOut),
                    new BN(PUMPAMM_BUY_AMOUNT * 1.1),
                    coinCreator,
                    userKp,
                    solanaConnection);

                //  save buy data to db
                await new AmmBoughtModel({
                    mint: mint.toBase58(),
                    pool: migrateData.pool.toBase58(),
                    creator: coinCreator.toBase58(),
                    solReserve: solReserve.toString(),
                    tokenReserve: tokenReserve.toString()
                }).save();
            } catch (e) {
                logLogger.log(e as string);
            }
            return;
        }
    }

    //  check bought this token
    const exist = await BoughtModel.exists({ mint: mint.toBase58() });

    if (!exist) return;

    infoLogger.info("sell token, mint:", mint.toBase58());

    ////  sell token
}