import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import TokenModel from '../models/tokenModel'
import { errorLogger, logLogger } from '../utils/logger';
import { sleep } from '../utils/sleep';
import { PUMPAMM_TP_RATE, solanaConnection, userKp } from '../core/config/env';
import fs from 'fs';
import path from 'path';
import { sellTokenJup } from '../lib/jupiter/sell-token-jup';

export const checkPoolBalance = async () => {
    // console.log("==========================");
    // console.log("cron - check pool balance");

    try {
        const tokens = await TokenModel.find({});

        for (const token of tokens) {
            //  check pool
            const vault = new PublicKey(token.vault);
            const solReserve = await solanaConnection.getBalance(vault, 'processed');

            //  sell token if needed
            if (solReserve >= token.balance * PUMPAMM_TP_RATE) {
                try {
                    ////  use sell in from jup or custom ix in ../lib/


                    await token.deleteOne()
                } catch (e) {
                    console.log(e);
                }
            }

            await modifyLastLogFile(token.mint, (solReserve / LAMPORTS_PER_SOL).toFixed(1));

            if (solReserve / LAMPORTS_PER_SOL <= 5) {
                //  remove token from db
                await token.deleteOne()
            }

            //  sleep 500m sec to avoid rate limit
            await sleep(500);
        }
    } catch (e) {
        errorLogger.log("error fetching all tokens:", e);
    }
}

const modifyLastLogFile = async (mint: string, balance: string) => {
    const logDir = path.join(__dirname, '../../logs/info');

    fs.readdir(logDir, async (err, files) => {
        if (err) {
            errorLogger.log('Error reading directory:', err);
            return;
        }

        // Filter for .log files and get the last one sorted by name (or you could sort by modified time if needed)
        const logFiles = files.filter(file => file.endsWith('.txt'));
        const lastFile = logFiles.sort().pop(); // Get the last file (based on alphanumeric sort)

        if (!lastFile) {
            errorLogger.log('No log files found.');
            return;
        }

        const filePath = path.join(logDir, lastFile);

        // Read the last file
        fs.readFile(filePath, 'utf-8', (err, data) => {
            if (err) {
                errorLogger.log('Error reading file:', err);
                return;
            }

            // Split the content into lines
            const lines = data.split('\n');

            // Modify the specific line
            const updatedLines = lines.map(line => {
                if (line.includes(mint)) {
                    return line + ': ' + balance; // Append balance
                }
                return line;
            });

            // Write the updated content back to the file
            fs.writeFile(filePath, updatedLines.join('\n'), 'utf-8', (err) => {
                if (err) {
                    errorLogger.log('Error writing to file:', err);
                    return;
                }
                errorLogger.log(`Successfully updated the line in ${lastFile}.`);
            });
        });
    });
};
