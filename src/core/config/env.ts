// src/core/config/env.ts

import { Cluster, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as fs from 'fs'
import { get } from 'env-var';
import 'dotenv/config';
import { DEVNET_PROGRAM_ID, MAINNET_PROGRAM_ID } from '@raydium-io/raydium-sdk';
import NodeWallet from '@jito-lab/provider/dist/esm/nodewallet';

export const envs = {
    PORT: get('PORT').required().asPortNumber(),
    API_PREFIX: get('DEFAULT_API_PREFIX').default('/api/v1').asString(),
    NODE_ENV: get('NODE_ENV').default('development').asString(),

    SOLANA_MAINNET_RPC: get('SOLANA_MAINNET_RPC').default('https://api.mainnet-beta.solana.com').asString(),
    SOLANA_DEVNET_RPC: get('SOLANA_DEVNET_RPC').default('https://api.devnet.solana.com').asString(),

    PRIVATE_KEY_PATH: get('PRIVATE_KEY_PATH').required().asString(),

    XAPI_KEY: get('XAPI_KEY').required().asString(),
    XAPI_URL: get('XAPI_URL').required().asString()
};

export const JITO_FEE = 100000;
export const X_BEARER = "";

export const MAX_CANDLE_CNT = 10;
export const PUMPAMM_TP_RATE = 2;

export const LAUNCH_MIN_BUY_SOL = 0.3 * LAMPORTS_PER_SOL;   //  0.3 SOL
export const LAUNCH_MAX_BUY_SOL = 15 * LAMPORTS_PER_SOL;   //  15 SOL

export const BUY_SOL_AMOUNT = 0.2 * LAMPORTS_PER_SOL;  //  0.2 SOL
export const PUMPAMM_BUY_AMOUNT = 0.5 * LAMPORTS_PER_SOL;  //  0.5 SOL

export const userKp = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(envs.PRIVATE_KEY_PATH, 'utf-8'))),
    { skipValidation: true },
);
export const userWallet = new NodeWallet(userKp);

const cluster: Cluster = "mainnet-beta";

export const solanaConnection = cluster.toString() == "mainnet-beta"
    ? new Connection(envs.SOLANA_MAINNET_RPC)
    : new Connection(envs.SOLANA_DEVNET_RPC);

export const raydiumProgramId = cluster.toString() == "mainnet-beta"
    ? MAINNET_PROGRAM_ID
    : DEVNET_PROGRAM_ID;

export const feeDestination = cluster.toString() == "mainnet-beta"
    ? new PublicKey("7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5") // Mainnet
    : new PublicKey("3XMrhbv989VxAMi3DErLV9eJht1pHppW5LbKxe9fkEFR"); // Devnet