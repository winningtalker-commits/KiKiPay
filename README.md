# KiKiPay — Private Payroll & Splits

> A Midnight dApp that lets an organization pay pot members **without exposing who the members are, who got paid, or how much each payment was** — Compact contract, ZK proofs generated in the browser, React + Vite frontend.

[![CI](https://github.com/winningtalker-commits/KiKiPay/actions/workflows/ci.yml/badge.svg)](https://github.com/winningtalker-commits/KiKiPay/actions/workflows/ci.yml)

## Live Demo

**https://kikipay.vercel.app**

Connect a Lace wallet, generate a ZK proof locally in the browser, and
register a payroll pot on the live Preprod contract — no proof-server
infrastructure required from the visitor.

## Contract Address

| Network  | Address                                                                  |
|----------|--------------------------------------------------------------------------|
| Preview  | `0x74d6f4b7f37dbb455b4d89edd8d3e6e869ee077c3e27a9671101220203fc261f`     |
| Preprod  | `0xcbeb5ef7cbb746840d83a10ddd7387e49488605b60ea4205a4cf3eb8450b1ca5`     |

*(Deployed to Preview and Preprod on 2026-09-29. Verify at
[midnightexplorer.com](https://midnightexplorer.com) or via the indexer —
the query root field is `contractAction` (a `contract` field does not exist
on this API version):*

```bash
curl -s -X POST https://indexer.preprod.midnight.network/api/v4/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address: \"cbeb5ef7cbb746840d83a10ddd7387e49488605b60ea4205a4cf3eb8450b1ca5\") { address state transaction { hash } } }"}'
```

A deployed contract answers with `"contractAction": { "address": "…",
"state": "6d69646e…", "transaction": { "hash": "…" } }` — the `state` blob is
the serialized contract ledger. The Preprod deploy tx was
`66547869633d24bb5f86f14edd6dc22495b8c6a26be64b49dc212fc149077b4c`.*

### Deployer wallets

The wallets that paid the deploy transactions (testnet tNIGHT only):

| Network | Deployer address | Fund with tNIGHT |
|---------|------------------------------------------------------------------|---|
| Preview | `mn_addr_preview1we7ldv0fr39nglfyz6nxe7j8szq8wyla0apx5pzkzlyhe9tn8eystp6t5x` | [faucet.preview.midnight.network](https://faucet.preview.midnight.network) |
| Preprod | `mn_addr_preprod1tzfwpanhw67vegsvalguwpfr2nml58z9ljgltljep9zr30sqdc7s2pmlxl` | [faucet.preprod.midnight.network](https://faucet.preprod.midnight.network) |

The 24-word recovery phrases are **not** committed here — they live only in
`.midnight-state.json` (gitignored). Back yours up when the deploy script
prints it; anyone holding the phrase controls the wallet.

## What This Does

KiKiPay is a payroll pot for a private member list:

1. **`registerPot`** — the sponsor registers a Merkle root committing to the
   approved members (up to 16, tree depth 4) and becomes the paymaster.
2. **`pay`** — the paymaster authorizes a payment to any member. The chain
   sees **only a hiding commitment** to the (payee, amount) pair and an
   incremented payment counter.
3. **`rotatePot`** — the paymaster swaps the member set for a new root
   (hiring/firing), proving they are still a member of the *new* set.

The Level 2 frontend drives `registerPot` end to end: click a button, the
browser derives the member secrets, builds the Merkle tree, generates the ZK
proof locally, and submits the transaction — the chain sees only the new pot
root.

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

**Deliberate `disclose()` usage** (every disclosure in the contract is
commented):

1. the new Merkle root in `registerPot` / `rotatePot` — membership *changes*
   must be auditable even though members stay anonymous;
2. the paymaster binding — authorization must be publicly verifiable;
3. the payment commitment in `pay` — payments must be publicly countable and
   later provable by the payee (who holds the secret).

## Privacy Claim

**An on-chain observer of the Preprod contract sees exactly four values — the
Merkle root `potRoot`, the `paymaster` commitment, the latest
`lastPaymentCommitment`, and the `paymentCount` counter — and can verify that
a payment happened and was authorized. The same observer cannot learn who the
members are, who the paymaster is, who any payment went to, or how much any
payment was; those values exist only as ZK circuit witnesses, are generated in
the user's browser at call time, are never rendered by the UI, never appear in
a transaction payload beyond the proof itself, and never reach the server —
there is no KiKiPay backend at all (the frontend is a static Vercel/Netlify
site; the only network calls are to the public Preprod indexer and the proof
server).**

This is enforced, not asserted: `scripts/ui-smoke.mjs` renders the deployed
site in headless Chromium and fails if any private-input marker appears in the
DOM.

## Tech Stack

- **Midnight network** — Preprod testnet (contract) + public indexer
- **Compact** language, compiled with `compactc` 0.31.1 (runtime 0.16.0)
- **Midnight.js SDK 4.1.1** (`midnight-js-contracts`, `midnight-js-network-id`,
  `midnight-js-http-client-proof-provider`, `midnight-js-indexer-public-data-provider`,
  `midnight-js-level-private-state-provider`, `midnight-js-protocol`) +
  `@midnight-ntwrk/dapp-connector-api` (Lace)
- **React 19 + Vite 7** frontend, TypeScript strict
- **Lace wallet** (Midnight edition) — connect, network guard, tx relaying
- **Node.js 22+**, vitest (14 tests), Playwright (UI smoke)
- **Docker** (proof server + local devnet for the Level 1 CLI pipeline)
- Deploys: **Vercel** (`vercel.json`) or **Netlify** (`netlify.toml`)

> **Note on `@midnight-ntwrk/midnight-js-network-provider`:** the challenge
> brief lists this package, but it does not exist on npm at any version
> (verified 2026-09-30: `npm view` → 404). Its function — selecting the
> Midnight network — lives in `@midnight-ntwrk/midnight-js-network-id`
> (`setNetworkId`) plus the dapp-connector's `connect(networkId)`, both of
> which this dApp uses. Same situation as the stale
> `@midnight-ntwrk/compact-compiler` package documented in the Level 1 brief.

## Prerequisites

- **Lace wallet** browser extension (Midnight edition) —
  https://www.lace.io/midnight — with a Preprod test wallet
- **Node.js 22** or newer (`node --version`) — CI pins 22
- npm

For the Level 1 contract pipeline additionally: Docker (proof server) and the
Compact toolchain — see the *Contract pipeline* section under Run Locally.

## Run Locally

**Frontend (the dApp):**

```bash
git clone https://github.com/winningtalker-commits/KiKiPay
cd KiKiPay
npm install
npm run dev          # → http://localhost:5173
```

That's the whole flow: the compiled contract and ZK keys are committed (the
browser needs them at runtime) and `npm run dev` copies them into `public/`
automatically. Open the URL, install/enable Lace, connect, call the circuit.

Production build + local preview:

```bash
npm run build        # typecheck + vite build (includes copy-zk)
npm run preview      # serve dist/ at http://localhost:4173
node scripts/ui-smoke.mjs http://localhost:4173   # headless UI smoke test
```

**Deploy the frontend:**

```bash
# Vercel (vercel.json already configured):
npm i -g vercel
vercel --prod             # first run: link the project, accept defaults

# Netlify (netlify.toml already configured):
npm i -g netlify-cli
netlify deploy --build --prod
netlify deploy --build --prod --site <your-site-id>   # or link once interactively
```

Both platforms run `npm run build` and publish `dist/`; the SPA rewrites and
the `/contract/*` headers (caching + CORS for the ZK keys) are already in the
configs. After deploying, paste the live URL into
[Live Demo](#live-demo) above.

**Contract pipeline (Level 1 CLI: recompile, redeploy, on-chain console):**

```bash
npm run compile             # requires the Compact toolchain (below)
npm run proof-server:start  # docker compose up -d
npm run deploy -- --network preprod   # pauses until the faucet funding lands
```

Toolchain install (the old `@midnight-ntwrk/compact-compiler` npm package no
longer exists — the toolchain ships from GitHub releases):

```bash
mkdir -p /tmp/compact-install && cd /tmp/compact-install
curl -sL -o compact-installer.sh \
  "https://github.com/midnightntwrk/compact/releases/download/compact-v0.5.2/compact-installer.sh"
sh compact-installer.sh            # installs the `compact` CLI to ~/.local/bin
compact update 0.31.1              # downloads the compactc 0.31.1 compiler
compact --version                  # → compact 0.5.2
```

After deploying, paste the printed contract address into the
[Contract Address](#contract-address) table above.

## Networks & Funding (testnet tNIGHT — all free)

| Resource | Preview | Preprod |
|---|---|---|
| **Faucet** | https://faucet.preview.midnight.network | https://faucet.preprod.midnight.network |
| **Block explorer** | https://midnightexplorer.com | https://midnightexplorer.com |
| Indexer (GraphQL) | https://indexer.preview.midnight.network/api/v4/graphql | https://indexer.preprod.midnight.network/api/v4/graphql |

`npm run deploy` generates a 24-word BIP-39 phrase per network (printed once,
stored gitignored in `.midnight-state.json`). Import it into Lace to watch the
balance. Re-running the deploy is safe — it skips funding if the wallet is
already funded.

## Run Tests

On a fresh clone, **compile first** (or skip — `contracts/managed/` is
committed, so the tests run out of the box on this repo):

```bash
npm test          # 14 tests: circuit logic, state transitions, privacy
npm run typecheck # tsc --noEmit
```

The suite executes the **real compiled circuits** through the Compact runtime
(no mocks): Merkle membership from both child positions, paymaster
authorization (positive + negative), pot registration/rotation, and explicit
privacy checks that no secret, path, or amount ever appears in public state.

```bash
npm run cli -- --demo   # offline walkthrough of the circuits (no wallet needed)
npm run test:e2e        # reconnect to the deployed contract on-chain
```

## Project Structure

```
KiKiPay/
├── contracts/
│   ├── kikipay.compact        ← the Compact contract (public vs private doc block)
│   ├── witnesses.ts           ← witness implementations (shared by tests/dApp/CLI)
│   └── managed/kikipay/       ← compiled output (COMMITTED — the browser needs it)
│       ├── contract/          ← compiled circuits + TS binding (index.js)
│       ├── keys/              ← registerPot / pay / rotatePot prover+verifier keys
│       └── compiler/ zkir/    ← compiler metadata + ZK intermediate reprs
├── src/                       ← the Level 2 frontend (React + Vite)
│   ├── components/
│   │   ├── WalletConnect.tsx  ← wallet connect/disconnect UI + typed errors
│   │   └── CircuitCall.tsx    ← circuit call button + result display
│   ├── hooks/
│   │   └── useMidnight.ts     ← Midnight.js SDK hook (detection → session)
│   ├── lib/                   ← merkle, zk-config, address, constants
│   ├── App.tsx / main.tsx     ← app shell + entry
│   └── shims.ts, crypto-shim  ← Node-API browser shims (buffer/process/…)
├── cli/                       ← Level 1 deploy tooling + console (node-side)
├── tests/
│   └── kikipay.test.ts        ← 14 tests over the real compiled circuits
├── scripts/
│   ├── ui-smoke.mjs           ← Playwright: renders the site, asserts UI + privacy
│   ├── copy-zk-assets.mjs     ← managed → public/ (runs before dev/build)
│   └── e2e-check.ts           ← node-side on-chain reconnect check
├── public/                    ← favicon + vite-served ZK assets (gitignored copy)
├── docs/screenshots/          ← README screenshots
├── index.html, vite.config.ts ← Vite entry + browser shim config
├── vercel.json, netlify.toml  ← deploy configs (SPA rewrites, /contract headers)
├── .github/workflows/ci.yml   ← toolchain → compile → test → typecheck → build
├── docker-compose.yml         ← local devnet (node, indexer, proof server)
└── README.md
```

## Initial Idea

I started from a problem I kept running into: payroll leaks. Every month a
traditional payroll run exposes the full social graph of an organization — who
is on the list, who got paid this cycle, and exactly how much each person earns
— to the bank, the blockchain, and anyone who can read the ledger. For activist
groups, diaspora communities sending money home, or DAOs paying anonymous
contributors, that is not a compliance footnote; it is a safety problem.

So I set out to build the smallest thing that still counts as a real payroll: a
pot that pays approved members while the chain learns as little as possible. I
wanted exactly three things to be public, and nothing else:

- **one Merkle root** proving a *set of approved members exists* — without
  revealing who they are;
- **one commitment per payment** proving *a payment happened and was
  authorized* — without revealing the payee or the amount;
- **one counter**, so an outsider can still audit *that* payroll is flowing.

The constraint I kept coming back to was that privacy I cannot demonstrate is
not privacy — I did not want "privacy-preserving" in the marketing sense. That
is what pulled me to Midnight: the Compact contract keeps member secrets,
Merkle paths, and amounts as **witnesses** that never leave the prover, and
`disclose()` turns every public value into a deliberate, reviewable choice
instead of an oversight.

From there the scope stayed deliberately narrow: three circuits (`registerPot`,
`pay`, `rotatePot`), a 16-member tree (depth 4), and a test suite that asserts
the negative property as loudly as the positive one — no secret, path, or
amount ever reaches public state, and two payments of the same amount stay
unlinkable across payees.

Level 2 added the operator UI: connect Lace, and the browser does the proving.
Two things I did not plan for shaped the build: the toolchain in the original
brief was already stale (the `@midnight-ntwrk/compact-compiler` npm package no
longer exists, and Level 2's `midnight-js-network-provider` never did), so I
pinned the compactc 0.31.1 / runtime 0.16.0 pairing that midnight-js 4.1.1
expects and used `midnight-js-network-id` for network selection instead. And
once the deploy pipeline worked I did not stop at one network: the same
contract runs on Preview and Preprod, which forced the faucet-pause, DUST, and
wallet-state handling to be genuinely robust rather than a one-off script.

The next level is where I started: real splits rather than a single payee per
payment.

## Screenshots

Captured on 2026-09-30 by running each command and rendering its real output
with [termshot](https://github.com/homeport/termshot).

### 1. Compile — the three circuits

![npm run compile](docs/screenshots/compile.png)

### 2. Tests — all 14 named tests passing

![npm test -- --reporter=verbose](docs/screenshots/tests.png)

### 3. Offline demo — the public ledger after two payments

![npm run cli -- --demo](docs/screenshots/demo.png)

### 4. Deploy to the Midnight Preprod testnet

![preprod deploy](docs/screenshots/deploy.png)

### 5. Verify — e2e check against the live Preprod contract

![npm run test:e2e](docs/screenshots/verify.png)

## Demo Video

[PLACEHOLDER — I will add the link after recording]

Recording checklist (under 2 minutes, against https://kikipay.vercel.app):

1. **Connect** — click "Connect Lace wallet", approve in Lace, and show the
   shielded + transparent addresses appear on screen.
2. **Call the circuit** — click "Call registerPot — Proved without revealing
   your input"; the loading state shows the proof being generated locally
   ("Generating ZK proof locally…").
3. **On-chain result** — the success panel shows the tx id and new pot root;
   the Public Ledger panel below refreshes from the Preprod indexer.
4. **Privacy point** — show that nowhere in the UI were member secrets or
   amounts displayed; the only values on screen are what the chain publishes
   (root, commitments, counter). Point out the button's label and the footer:
   "private inputs never leave your browser".
