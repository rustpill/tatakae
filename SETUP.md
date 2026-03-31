# Tatakae - Development Setup

This guide covers running the project locally or setting up a deployed version. For local setup while the D1 database will be local, the R2 bucket will be remote.

| Component | Local | Remote |
|---|---|---|
| Solana validator | `localhost:8899` | Devnet / Mainnet |
| Cloudflare Worker | `localhost:8787` | Cloudflare |
| D1 database | Local | Cloudflare D1 |
| R2 storage | Cloudflare R2 | Cloudflare R2 |
| Frontend | `localhost:3000` | Vercel (or any host) |

> Local testing still uses the remote R2 bucket, this is intentional.

---

## Step 0 - Install dependencies, clone

```bash
# From the repo root
pnpm install

# Clone example files
cp anchor/.env.example anchor/.env.local
cp frontend/.env.example frontend/.env.local
cp indexer/wrangler.toml.example indexer/wrangler.toml
cp indexer/.dev.vars.example indexer/.dev.vars
```

---

## Step 1 - Create R2 Cloudflare resources

The setup script uploads NFT images, metadata, and Merkle proofs to a Cloudflare R2 bucket. You need a real R2 bucket even for local development.

### Create an R2 bucket

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com/) → **R2 → Create bucket**
2. Enable public access: **Settings → Public Development URL → Allow Access**
3. Copy the R2 URL `https://pub-xxxx.r2.dev`
4. Set `R2_BUCKET_NAME` in [anchor](./anchor/.env.example)
5. Set `R2_PUBLIC_URL` in [anchor](./anchor/.env.example)
6. Set `NEXT_PUBLIC_R2_PUBLIC_URL` in [frontend](./frontend/.env.example)

### Create an R2 API token

1. Go to **R2 → Manage R2 API Tokens → Create API Token**
2. Grant **Object Read & Write** on your bucket
3. Save the **Access Key ID** and **Secret Access Key**
4. Set `R2_ACCESS_KEY_ID` in [anchor](./anchor/.env.example)
5. Set `R2_SECRET_ACCESS_KEY` in [anchor](./anchor/.env.example)
6. Set `R2_ACCOUNT_ID` in [anchor](./anchor/.env.example)

---

## Step 2 - Create a D1 database

```bash
# You may need to login to cloudflare
cd indexer
wrangler d1 create <database_name>
```
>Copy the `database_id` and `database_name` into `wrangler.toml` below.

## Step 3 - Configure and start the Cloudflare Worker

### Edit [`wrangler.toml`](./indexer/wrangler.toml.example)

```toml
name = "project_name"
account_id = "R2_ACCOUNT_ID"
main = "src/index.ts"
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]

[triggers]
crons = ["* * * * *"]

[[r2_buckets]]
bucket_name = "R2_BUCKET_NAME"
binding = "R2" # Don't change
remote = true

[[d1_databases]]
database_name = "database_name"
binding = "D1" # Don't change
database_id = "database_id"
```

> `remote = true` on the R2 binding tells Wrangler to use your remote bucket in local dev mode. This is intentional.

### Apply [`./migrations`](./indexer/migrations)

```bash
cd indexer
wrangler d1 migrations apply <database_name> [--local|--remote]
```

### Edit [`.dev.vars`](./indexer/.dev.vars.example)

```env
RPC_URL=                        # solana rpc
AUTHORITY_KEYPAIR=[1,2,3,...]   # cat ~/.config/solana/id.json
WORKER_SECRET=any_secret
```
> Set the `WORKER_SECRET` value in [anchor](./anchor/.env.example) to match this. It must be the same.

### Start the Worker
```bash
# Set the WORKER_URL in anchor .env
cd indexer
wrangler [dev|deploy]

```

The dev `WORKER_URL` runs at `http://localhost:8787`.

> **Triggering the battle resolver manually** - Wrangler does not fire crons automatically in dev mode. After a battle is accepted, trigger the resolver with:
> ```bash
> curl "http://localhost:8787/cdn-cgi/handler/scheduled"
> ```

If you used `wrangler deploy` it will give you a deployed `WORKER_URL`. You also need to set the deployed env vars as shown below.

```bash
# If you used `wrangler deploy`
wrangler secret put RPC_URL
wrangler secret put AUTHORITY_KEYPAIR
wrangler secret put WORKER_SECRET
```

---

## Optional - Start the local validator

```bash
# For local deployment

# Metaplex token metadata program must be cloned from mainnet
cd anchor
solana config set --url RPC_URL # default http://127.0.0.1:8899
solana-test-validator --reset \
  --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
  --url mainnet-beta
```

Leave this running, open another terminal for the next steps.
> Use `solana-test-validator --ledger test-ledger` to reuse the same validator state.

---

## Step 4 - Build and deploy the Anchor program

### Edit [constants.rs](`./anchor/programs/anchor/src/constants.rs`)
```rust
// Run solana-keygen pubkey, to get your publickey
pub const PROGRAM_AUTHORITY: Pubkey = pubkey!("YOUR_PUBLIC_KEY");

```

### Edit [anchor/.env.local](`./anchor/.env.example`)
```bash
# The remaining values to set
WORKER_URL=                  # WORKER_URL
WORKER_SECRET=any_secret     # same value in .dev.vars
RPC_URL=                     # RPC_URL
```

### Build & Deploy

```bash
# Optional - For deploying to dev/test/main net
solana config set --url RPC_URL
```

> `anchor deploy` auto configures where to deploy based on RPC

```bash
cd anchor
anchor keys sync  # Updates program id to match your keypair
anchor build
anchor deploy
```
> You may need to manually change the program ID in `/src/lib.rs` and redeploy with the new address, if it fails.

### Copy the IDL to the other packages

After building, copy the generated IDL into the frontend and indexer.

```bash
# Frontend
cp target/idl/anchor.json ../frontend/src/idl/anchor.json
cp target/types/anchor.ts ../frontend/src/idl/anchor.ts

# Indexer
cp target/idl/anchor.json ../indexer/src/idl/anchor.json
cp target/types/anchor.ts ../indexer/src/idl/anchor.ts
```
> If you are using `wrangler dev` it will auto restart the server, if you are using the deployed version, redo the command `wrangler deploy` in the indexer directory.

### Optional - Uncomment the airdrop block in [`setup.ts`](./anchor/tests/scripts/setup.ts)

If you are using local production, open [`setup.ts`](./anchor/tests/scripts/setup.ts) and uncomment the airdrop section it is emitted for the other networks:

```typescript
// Airdrop
const sig = await connection.requestAirdrop(keypair.publicKey, 1e9);
```

> Remember to comment this back out before deploying to dev/test/main net.

### Run the setup script

```bash
# From root
pnpm --filter anchor run setup
```

This will:
1. Mint 100 fighter NFTs.
2. Upload images and metadata to the Cloudflare R2.
3. Build the Merkle tree and initialize the on-chain config PDA.
4. Upload Merkle proofs to the R2.
5. Seed the D1 faucet table via the Worker.

>**Copy the `COLLECTION_MINT` address** printed at the end - you need it for the frontend. It's also in the `scripts/output/setup.json`

---

## Step 6 - Configure the frontend

### Edit [`.env.local`](./frontend/.env.example)

```env
NEXT_PUBLIC_PROGRAM_ID=         # After syncing, copy from declare_id!(...) 
NEXT_PUBLIC_COLLECTION_MINT=    # Output from setup script
NEXT_PUBLIC_RPC_URL=            # RPC_URL
NEXT_PUBLIC_WORKER_URL=         # WORKER_URL
NEXT_PUBLIC_R2_PUBLIC_URL=      # Set in Step 1
```

### Start the server:

```bash
pnpm run dev
```

Frontend is at `http://localhost:3000`.

> If you choose to deploy to a hosting service, set the frontend .env directly on the site rather than using an env file.

---

## Full local startup order (after setup)

Run each in its own terminal:

```
Terminal 1 - Solana validator
  cd anchor
  solana-test-validator --reset \
    --clone-upgradeable-program metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s \
    --url mainnet-beta

Terminal 2 - Cloudflare Worker
  cd indexer
  wrangler dev

Terminal 3 - Frontend
  cd frontend
  pnpm run dev
```

Re-run the setup script only when resetting the validator with `--reset`.

---

## Running tests

> Note: Running the test moves ownerships of NFTs, ignores faucet requirements. If you do run a test, make sure to reset your validator and redeploy program.

```bash
cd anchor
anchor test --skip-local-validator --skip-deploy
```

---

## Resetting local state

### Reset D1 tables

```bash
cd indexer
wrangler d1 execute DB --local --command "DELETE FROM battle_history;"
wrangler d1 execute DB --local --command "DELETE FROM faucet_fighters;"
```

### Full reset

Stop the validator, restart it with `--reset`, re-run `anchor deploy`, clear the D1 tables above, then re-run `setup.ts`. R2 assets will be overwritten automatically.

---

## Environment variable reference

### [`anchor/.env.local`](./anchor/.env.example)

| Variable | Description |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID (dashboard sidebar) |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret key |
| `R2_BUCKET_NAME` | Name of the R2 bucket |
| `R2_PUBLIC_URL` | Public base URL for the bucket (e.g. `https://pub-xxx.r2.dev`) |
| `WORKER_URL` | `http://localhost:8787` or `PROVIDED` |
| `WORKER_SECRET` | Any string - must match `WORKER_SECRET` in `.dev.vars` |
| `RPC_URL` | `http://127.0.0.1:8899` or `PROVIDED` |

### [`indexer/.dev.vars`](./indexer/.dev.vars)

| Variable | Description |
|---|---|
| `RPC_URL` | `http://127.0.0.1:8899` or `PROVIDED` |
| `AUTHORITY_KEYPAIR` | JSON byte array from `~/.config/solana/id.json` |
| `WORKER_SECRET` | Must match `WORKER_SECRET` in `anchor/.env.local` |

### [`frontend/.env.local`](./frontend/.env.example)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_PROGRAM_ID` | Found in `lib.rs` |
| `NEXT_PUBLIC_COLLECTION_MINT` | `setup.ts` output |
| `NEXT_PUBLIC_RPC_URL` | `http://127.0.0.1:8899` or `PROVIDED` |
| `NEXT_PUBLIC_WORKER_URL` | `http://localhost:8787` or `PROVIDED` |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | Same as `R2_PUBLIC_URL` in `anchor/.env.local` |