import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { checkMetadata } from "../checker/check-metadata";
import { sleep } from "../utils/sleep";
import { ONE_SEC } from "../core/constants";
import { errorLogger, infoLogger, logLogger } from "../utils/logger";
import { countUniquePosts, getCa } from "../utils/xapi";
import { solanaConnection, userKp } from "../core/config/env";
import TokenModel from "../models/tokenModel";

export const handleCreate = async (
    launchpad: string,
    name: string,
    symbol: string,
    uri: string,
    mint: PublicKey,
    vault: PublicKey,
    tokenVault: PublicKey,
    tx: string,
    lamports: number,
    supply: number
) => {
    //  check uri is on ipfs
    if (!uri.startsWith("https://ipfs.io/ipfs/")) return;

    ////  criteria_1

    //  check metadata from ipfs
    const { code, link } = await checkMetadata(uri);
    if (code < 0) return;

    //  wait for 15 sec and get vault balance
    await sleep(15 * ONE_SEC);
    const vaultBalance1 = await solanaConnection.getBalance(vault, "processed");

    ////  criteria_2

    //  get holders cnt
    const holders1 = await solanaConnection.getTokenLargestAccounts(mint, "processed");
    const { count: cntHolders1, sum: topAmount1 } = holders1.value.reduce((acc, value) => {
        if (value.uiAmount) {
            acc.count += 1;
            if (!value.address.equals(tokenVault))
                acc.sum += value.uiAmount;
        }
        return acc;
    }, { count: 0, sum: 0 });
    const topPercent1 = topAmount1 / supply * 100;

    ////  criteria_3

    ////  criteria_4
    ////  get posts on x
    const posts = await countUniquePosts(mint.toBase58());

    ////  criteria_5 - posts

    logLogger.log("-----------------------------------------");
    logLogger.log(`launch: ${launchpad}, tx: ${tx}`);
    logLogger.log(`buy: ${(lamports / LAMPORTS_PER_SOL).toFixed(1)}, name: ${name}, symbol: ${symbol}, mint: ${mint.toBase58()}, link: ${link}`);
    logLogger.log(`hold1: ${cntHolders1}, topP1: ${topPercent1.toFixed(1)}`);
    // logLogger.log(`vault1: ${(vaultBalance1 / LAMPORTS_PER_SOL).toFixed(1)}, vault2: ${(vaultBalance2 / LAMPORTS_PER_SOL).toFixed(1)}, vault3: ${(vaultBalance3 / LAMPORTS_PER_SOL).toFixed(1)}, vault4: ${(vaultBalance4 / LAMPORTS_PER_SOL).toFixed(1)}`);
    logLogger.log(`user: ${posts.users}, like: ${posts.likes}, view: ${posts.views}`)

    infoLogger.log(`mint: ${(vaultBalance1 / LAMPORTS_PER_SOL).toFixed(1)}:`);


    try {
        ////  buy token
        //  use jupiter or custom buy instructions from ../lib/

        //  save token to tokensModel
        await new TokenModel({
            mint: mint.toBase58(),
            name,
            symbol,
            handle: link,
            uri,
            vault: vault.toBase58(),
            balance: vaultBalance1
        }).save()
    } catch (e) {
        errorLogger.error("can not save to token model, e:", e as string);
    }

    return;
}
