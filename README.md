# Solana sniper for pumpfun, pumpswap or pumpAmm, raydium launchpad(letsbonk.fun), believe or launchcoin(meteora DBC) with social check

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
Edit  `./src/handler/handle-create.ts` and `./src/handler/handle-migrate.ts` to ipmlement your sniping strategy.<br>
Like token filters, TP/SL percent, buy amount etc.

```javascript
    ////    criteria_*
    ...
    ////  buy token
```

```javascript
    ////    criteria_*
    ...
    ////  sell token
```
Edit `./src/checker/check-metadata.ts` and `./src/utils/xapi.ts` to check metadata and twitter posts in detail.

##  Run the bot
