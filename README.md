# Solana sniper for pumpfun, pumpswap or pumpAmm, raydium launchpad(letsbonk.fun), believe or launchcoin(meteora DBC) with social check

## How it works

* First subscribes transactions for token creation(migration) on pumpfun, pumpswap, raydium launchpad, believe(meteora).
* Parse the transaction, get mint, creator, metadata uri, initial buy amount.
* Check metadata and get posts on tweeter(X).
* Filter the tokens, buy, save to DB.
* Get list of bought tokens from DB, check pool balance. Sell if needed.
* Log launched tokens and bought tokens

##  How to install

### Prerequites

#### Install node environment. <br>

Here're some useful links for installing node environment.<br>
https://docs.npmjs.com/downloading-and-installing-node-js-and-npm <br>
https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-ubuntu-20-04

### Download the project

#### Setup git bash if you don't have it.<br>
https://git-scm.com/book/en/v2/Getting-Started-Installing-Git

#### Clone this project to local machine.
> git clone https://github.com/m8s-lab/solana-sniper

#### Install node modules.
> cd solana-sniper<br>
yarn

##  Configuration

### Set environment variables in `.env` file

#### Copy .env.template as .env and edit it.

> MONGO_URI: uri to mongo db that stores token data<br>
SOLANA_MAINNET_RPC: solana mainnet rpc url<br>
PRIVATE_KEY_PATH: path to a solana keypair file.<br>
XAPI_KEY: xapi key to get social info of tokens<br>
XAPI_URL: link to x provider

### Set target launchpads

For now, this bot listens pumpfun, pumpswap, raydium launchpad, believe(meteora DBC).<br>
Edit `./src/streaming/new-tokens.ts:L225` to add or remove launchpads.
```javascript
    transactions: {
        //  subscribe token create on pumpfun
        pumpfun: {
            ...
        },
        //  subscribe token migration from pumpfun to pumpswap
        pumpswap: {
            ...
        },
        //  subscribe token launch on raydium launchpad
        raydiumlaunch: {
            ...
        },
        //  subscribe token creation by believe(launchcoin)
        believe: {
            ...
        }
    }
```

### Implement your sniping strategy

#### Add criterias for your strategy.
Edit  `./src/handler/handle-create.ts`, `./src/handler/handle-migrate.ts`, `./src/cron/watch-pools.ts` to ipmlement your sniping strategy.<br>
Like token filters, TP/SL percent, buy amount etc.

```javascript
    ////  criteria_*
    ...
    ////  buy token
    ...
    ////  sell token
```

#### Edit your filter for social accounts.
Edit `./src/checker/check-metadata.ts` and `./src/utils/xapi.ts` to check metadata and twitter posts in detail.
```javascript
    //  return X link
    const socials = getSocialLinks(jsonData);
    ...
    //  return -1 if tweets and follwers are too small
    if (postCount < 10 || followerCount < 50 || followingCount > followerCount / 2) {
        return -1;
    }
```
##  Run and make profit
Finally, you're ready to run sniper and make profit. 😃

### Run bot
> yarn start

### Check log
Log files are stored in `./logs/`.<br>
You can check the log files and fix your strategy.<br>

#### Files in `./logs/log` store info for all launched tokens.<br>
```json

-----------------------------------------
launch: raydiumlaunch, tx: 4ywjKXNZyr8YpfUfdDfRZW1WWAW4ZhTdYxqinAGsjtRL81sho94k9AHCpWCdUbGSP69NxxLSVZ6KHSxD7BpD5AeU
buy: 3.0, name: Yuria, symbol: Yuria, mint: Ja9QM1RK7EafnQ9PNz4GZb1bPBYvLGYtifYooPybonk, link: https://www.instagram.com/stories/kabosumama/3640846729807247053?igsh===
hold1: 6, topP1: 17.9, hold2: 20, topP2: 39.6, bal1: 6.2, bal2: 20.8, bal2: 10.9
tweet user: 3, like: 0, view: 110
-----------------------------------------
launch: pumpfun, tx: 3YPoprDLSAF5utzJGEmrVxgFk7YJv63GTma5VH6bd6az83WVdmPnHFV1yGEt9cvFfz2hNbSK3ZbMhjJe8Jb9cBH6
buy: 2.0, name: Pipapeep, symbol: PIP, mint: GH7DjqN3ewHUf4vsDmcmz2jipFo2NMab3qehwqFopump, link: https://www.tiktok.com/@pipapeep?_t=ZS-8wfgLJ2Fz29&_r=1
hold1: 7, topP1: 17.8, hold2: 20, topP2: 28.4, bal1: 6.0, bal2: 10.8, bal2: 10.6
tweet user: 1, like: 1, view: 22
```
#### Files in `./logs/info` store vault balance for target tokens.<br>
```json
mint   users, likes, views, balance1, holders, top20 %, ....
DaQq...,  7,    10,   1115,     18.8,     16,     23.1, 37.1, 2.16, 85.0, 93.5, 97.8, 115.4, ...
E1Xn...,  4,    4,    93,       43.9,     20,     33.0, 35.8, 2.69, 85.0, 81.6, 90.7, 82.2,  ...
8h7i...,  4,    15,   1046,     10.4,     17,     21.5, 39.0, 0.73, 85.0, 94.9, 103.6, 71.2, ...
```

## Contact

* TG: https://t.me/microgift88
* Discord: https://discord.com/users/1074514238325927956
* Email: microgift28@gmail.com
