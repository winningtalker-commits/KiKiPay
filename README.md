# KiKiPay — Private Payroll & Splits

> A Midnight smart contract that lets an organization distribute funds to a group of members **without exposing who the members are, who got paid, or how much each payment was**.

## Contract Address

| Network  | Address                          |
|----------|----------------------------------|
| Preview  | [PASTE ADDRESS AFTER DEPLOY]     |
| Preprod  | [PASTE ADDRESS AFTER DEPLOY]     |

*(This section is MANDATORY. Leave placeholders until deployed, then paste the printed contract address here.)*

## What This Does

KiKiPay is a payroll pot for a private member list:

1. **`registerPot`** — the sponsor registers a Merkle root committing to the
   approved members (up to 16, tree depth 4) and becomes the paymaster.
2. **`pay`** — the paymaster authorizes a payment to any member. The chain
   sees **only a hiding commitment** to the (payee, amount) pair and an
   incremented payment counter.
3. **`rotatePot`** — the paymaster swaps the member set for a new root
   (hiring/firing), proving they are still a member of the *new* set.

An outside observer can verify that payments happened, that they were
authorized, and that recipients are legitimate members — but cannot learn
**who** the members are, **who** got paid, or **how much**.

## Privacy Model

**What is PUBLIC (on-chain, visible to anyone):**

| Ledger field            | Meaning                                                        |
|-------------------------|----------------------------------------------------------------|
| `potRoot`               | Merkle root over the member set (membership itself is hidden)  |
| `paymaster`             | Hash commitment binding the current distributor                |
| `lastPaymentCommitment` | Hiding commitment to the latest (payee, amount) pair           |
| `paymentCount`          | Number of payments executed                                    |

**What is PRIVATE (circuit inputs via witnesses, never on-chain):**

- `paymasterSecret()` — the distributor's secret key
- `payeeMemberSecret()` — the payee's secret key
- `payeeProofPath()` / `payeeSideBits()` — the payee's Merkle authentication path
- `paymentAmount()` — the payment amount

**What the user PROVES without revealing:**

- *"I am the paymaster bound by the public `paymaster` commitment"*
- *"The payee is inside the committed member tree `potRoot`"* (Merkle proof)
- *"A payment of this (secret) amount to this (secret) member was made"* —
  the public commitment is exactly the image of both secrets and the amount

**Deliberate `disclose()` usage** (required by the rubric — every disclosure
in the contract is commented):

1. the new Merkle root in `registerPot` / `rotatePot` — membership *changes*
   must be auditable even though members stay anonymous;
2. the paymaster binding — authorization must be publicly verifiable;
3. the payment commitment in `pay` — payments must be publicly countable and
   later provable by the payee (who holds the secret).

## Tech Stack

- **Midnight network** (preview / preprod testnets, local devnet via Docker)
- **Compact** language, compiled with `compactc` 0.31.1 (language 0.23.0, runtime 0.16.0) via the `compact` CLI 0.5.2
  — this is the pairing pinned by `create-mn-app` and matched to midnight-js 4.1.1
- **Node.js v22+**, TypeScript, vitest
- **Docker** (proof server + local devnet)

## Prerequisites

- Node.js ≥ 22 (`node --version`)
- npm
- Docker running (`docker info`)
- The Compact toolchain (CLI + compiler):

  ```bash
  # The old `npm i -g @midnight-ntwrk/compact-compiler` package no longer exists.
  # The toolchain now ships from GitHub releases:
  mkdir -p /tmp/compact-install && cd /tmp/compact-install
  curl -sL -o compact-installer.sh \
    "https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.2/compact-installer.sh"
  sh compact-installer.sh            # installs the `compact` CLI to ~/.local/bin
  compact update 0.31.1              # downloads the compactc 0.31.1 compiler
  compact --version                  # → compact 0.5.2
  ```

  Make sure `~/.local/bin` and `~/.compact/bin` are on your `PATH`.

## Setup

```bash
git clone https://github.com/winningtalker-commits/KiKiPay
cd KiKiPay
npm install

# 1. Compile the contract (creates contracts/managed/kikipay with ZK keys)
npm run compile

# 2. Start the proof server (needed for deploys and on-chain calls)
npm run proof-server:start

# 3a. Deploy to the Midnight PREVIEW testnet
#     (script pauses and prints the wallet address — fund it at the faucet
#      URL it prints; it detects the funding automatically and continues)
#     Full walkthrough with faucet/explorer links: see the next section.
NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preview

# 3b. …or everything locally on a one-command devnet (node+indexer+proof server)
npm run setup
```

After deploying, paste the printed contract address into the
[Contract Address](#contract-address) table above.

## Networks, Wallets & Funding

Everything below was verified live on 2026-09-29. All testnet tokens are free.

### Network cheat sheet

| Resource | Preview | Preprod |
|---|---|---|
| **Faucet (tNIGHT)** | https://faucet.preview.midnight.network | https://faucet.preprod.midnight.network |
| Faucet (alternate) | https://midnight-tmnight-preview.nethermind.dev | https://midnight-tmnight-preprod.nethermind.dev |
| **Block explorer** | https://midnightexplorer.com (pick network in the UI) | https://midnightexplorer.com |
| RPC node | https://rpc.preview.midnight.network | https://rpc.preprod.midnight.network |
| Indexer (GraphQL) | https://indexer.preview.midnight.network/api/v4/graphql | https://indexer.preprod.midnight.network/api/v4/graphql |
| Docs: funding guide | [docs.midnight.network/guides/acquire-tokens](https://docs.midnight.network/guides/acquire-tokens) | same |
| Docs: deploy guide | [docs.midnight.network/guides/deploy-and-operate](https://docs.midnight.network/guides/deploy-and-operate) | same |

### The wallet

- **Lace (Midnight edition)** — the official browser-extension wallet:
  https://www.lace.io/midnight
- `npm run deploy` generates a **24-word BIP-39 recovery phrase** the first
  time it runs on each network. It is printed **once** in the terminal and
  stored in `.midnight-state.json` (gitignored). The same phrase restores the
  identical wallet in Lace — import it there to watch your tNIGHT balance in
  a GUI (optional; the deploy pipeline does not need Lace).
- Each network gets its **own** phrase/address (per-network wallets in the
  state file) — don't reuse one network's phrase on the other.

### Funding flow (both networks are the same 4 steps)

1. Start the deploy for your target network:

   ```bash
   # Preview (recommended for Level 1):
   NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preview

   # …or Preprod:
   NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preprod
   ```

2. When it reaches **─── Fund Wallet ───** it prints your `Wallet address:`
   (a `mnaddr…` bech32 string) and pauses, polling every 10 s.
3. Open the matching **faucet** link from the table above, paste the address,
   request tNIGHT, and grab a coffee — the script **detects the funding
   automatically** and continues into DUST registration + the deploy tx.
4. Verify the results:
   - `Wallet Address` / `Balance` lines in the deploy output,
   - the **CONTRACT ADDRESS** banner at the end → paste into the
     [Contract Address](#contract-address) table,
   - look the contract address up on **https://midnightexplorer.com** (a
     fresh deployment can take a minute to appear in the explorer).

### After the deploy

```bash
npm run network preview          # confirm the active network + last deploy address
npm run check-balance            # tNIGHT / tDUST balances
npm run cli                      # interactive console against the deployed contract
npm run cli -- --demo            # offline circuit demo (no wallet needed)
```

For preprod, substitute `preprod` in every command. Re-running the deploy is
safe — the seed is preserved and the script skips funding if the wallet
already holds tNIGHT.

## Run Tests

```bash
npm test          # 14 tests: circuit logic, state transitions, privacy
```

The suite executes the **real compiled circuits** through the Compact runtime
(no mocks): Merkle membership from both child positions, paymaster
authorization (positive + negative), pot registration/rotation, and explicit
privacy checks that no secret, path, or amount ever appears in public state.

Bonus commands:

```bash
npm run cli -- --demo   # offline walkthrough of the circuits (no wallet needed)
npm run test:e2e        # reconnect to the deployed contract on-chain (after deploy)
npm run typecheck       # tsc --noEmit
```

## Project Structure

```
KiKiPay/
├── contracts/
│   └── kikipay.compact        ← the Compact contract (public vs private doc block)
├── managed/                   ← auto-generated by compact compile (gitignored, 56 MB)
│   └── kikipay/               ← circuits, proving/verifying keys, TS binding
├── src/                       ← deploy tooling + CLI (frontend comes in Level 2)
│   ├── deploy.ts              ← faucet-pause → DUST → deploy pipeline
│   ├── cli.ts                 ← interactive console (+ `--demo` offline mode)
│   ├── merkle.ts              ← off-chain mirror of the membership tree
│   ├── network.ts / wallet.ts ← Midnight.js network + wallet glue
│   └── setup.ts               ← one-command local devnet bootstrap
├── tests/
│   └── kikipay.test.ts        ← 14 tests over the real compiled circuits
├── .github/workflows/ci.yml   ← toolchain install → compile → test
├── docker-compose.yml         ← local devnet (node, indexer, proof server)
└── README.md
```

## Initial Idea

[LEAVE PLACEHOLDER — I will fill this in manually]

## Screenshots

[LEAVE PLACEHOLDER — I will add compile output and contract address screenshots]
