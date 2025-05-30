// src/app.ts

import mongoose from 'mongoose';
import cron from 'node-cron';

import { streamNewTokens } from './streaming/new-tokens';
import { sleep } from './utils/sleep';
import { checkPoolBalance } from './cron/watch-pools';
import { logLogger } from './utils/logger';

const listenNewTokens = async (attemp: number = 1) => {
    try {
        logLogger.log('attept to stream new tokens, attemp:', attemp++);

        await streamNewTokens();
    } catch (e) {
        console.log('streamNewTokens err:', e);

        //  sleep 1 min
        await sleep(1 * 60 * 1000);

        //  call listenNewTokens() recursively
        await listenNewTokens();
    }
}

const main = () => {
    //  start mongoose
    mongoose.connect(process.env.MONGO_URI || '')
        .then(async () => {
            console.log("Connected to the database! ❤️");

            listenNewTokens(1);
        })
        .catch((err) => {
            console.log("Cannot connect to the database! 😭", err);
            process.exit();
        });
}

//  check watch list every 1 min
cron.schedule('* * * * *', checkPoolBalance);

main();
