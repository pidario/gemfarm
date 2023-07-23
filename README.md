# Gem Farm 💎
_by Gemworks_

Gem Farm is a collection of on-chain Solana programs for NFT ("gem" 💎) staking.

It consists of:

- Gem Bank 🏦 - responsible for storing NFTs, lets you configure which mints are/not allowed into the vaults
- Gem Farm 🧑‍🌾 - responsible for issuing rewards, lets you configure fixed/variable rates, lock up periods, fees, rarities & more

Gem Bank is used under the hood by Gem Farm.

# Official deployment 🚀

Both programs are now officially deployed across all 3 networks (mainnet, devnet, testnet):
```
bank: 29j1S79rmS2tthGS6m8n6Cz94QNwuJ62HFmNDJjX6NfE
farm: BXdLcNcVbFHTfumox1qnz85YhVgw36t9CsQFtdQdTGLt
```

You can interact with them using this [front-end](https://cryptobac.art/) (or build your own).

# Deploy your own version 🛠

- `git clone` the repo 
- Make sure you have `solana-cli` installed, keypair configured, and at least 10 sol on devnet beforehand
- Update path to your keypair in `Anchor.toml` that begins with `wallet =`
- Run `anchor build` to build the programs
- We need to update the program IDs:
    - Run `solana-keygen pubkey ./target/deploy/gem_bank-keypair.json` - insert the new Bank prog ID in the following locations:
        - `./Anchor.toml`
        - `./programs/gem_bank/src/lib.rs`
        - `./src/index.ts` (replace GEM_BANK_PROG_ID)
    - And `solana-keygen pubkey ./target/deploy/gem_farm-keypair.json` - insert the new Farm prog ID in the following locations:
        - `./Anchor.toml`
        - `./programs/gem_farm/src/lib.rs`
        - `./src/index.ts` (replace GEM_FARM_PROG_ID)
- Run `anchor build` to build one more time
- Run `anchor deploy --provider.cluster devnet` to deploy to devnet
- Now copy the IDLs into the apps:
    - `cp ./target/idl/gem_bank.json ./app/gem-bank/public`
    - `cp ./target/idl/gem_bank.json ./app/gem-farm/public`
    - `cp ./target/idl/gem_farm.json ./app/gem-farm/public`
- alternatively you can run the script I prepared `./scripts/cp_idl.sh`
- (!) IMPORTANT - run `yarn` inside the root of the repo
- finally start the apps!
    - eg cd into `app/gem-bank` and run yarn && yarn serve
- don't forget to open Chrome's console with `CMD+SHIFT+I` to get feedback from the app when you click buttons. It currently doesn't have a notifications system

Note that deploying your own version will cost you ~20 SOL.

## building a production ready site:

cd into `app/gem-bank` and build it

`VUE_APP_MAINNET_URL=https://HOST/PATH/ yarn build`

do the same thing for `app/gem-farm`

now deploy both `app/gem-farm/dist` and `app/gem-bank/dist` folders and set them as the `ROOT_FOLDER` in the `nginx` configuration below

## nginx and tls:

install dependencies:

`apt install nginx certbot python3-certbot-nginx`

create default configuration, for example in `/etc/nginx/sites-available/default` (it might already exist, in this case, overwrite all the lines):

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    listen 443 default_server;
    listen [::]:443 default_server;
    ssl_reject_handshake on;
    
    server_name _;
    return 444;
}
```

enable it: `ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/`

create site configuration:

`/etc/nginx/sites-available/DOMAIN`

```
server {
    listen 80;
    listen [::]:80;
    
    root ROOT_FOLDER;
    index index.html index.htm index.nginx-debian.html;
    
    server_name DOMAIN WWW_DOMAIN_OPTIONAL;
    
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
```

enable site:

`ln -s /etc/nginx/sites-available/DOMAIN /etc/nginx/sites-enabled/`

test configuration:

`nginx -t`

request let's encrypt certificate:

`certbot --nginx -d DOMAIN`

verify auto renewal:

`systemctl status certbot.timer`

simulate renewal:

`certbot renew --dry-run`

# Debug cryptic errors ⚠️

If you get a cryptic error back that looks something like this: 
```
Transaction failed 0x1798
``` 
The steps to take are as follows:
- translate the 0x number into decimal (eg using [this](https://www.rapidtables.com/convert/number/hex-to-decimal.html?x=0x66)) - eg 0x1798 becomes 6040
- if the number is 6XXX, this is a custom error from the app. Go to errors.rs found [here](https://github.com/gemworks/gem-farm/blob/main/lib/gem_common/src/errors.rs) and find the error numbered 40 (the remainder of the decimal)
- any other number besides 6XXX means an anchor error - go [here](https://github.com/project-serum/anchor/blob/master/lang/src/error.rs) to decipher it

# Docs ✏️

Extensive documentation is available [here](https://docs.gemworks.gg/).

The answer you're looking for is probably there. Pls don't DM with random questions.

# License 🧾

MIT
