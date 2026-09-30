# Product Proposal

## What is the product, and who uses it?
KiKiPay is a private payroll pot. A sponsor registers a pot by committing — as a Merkle root — to an approved member list of up to 16 recipients; a paymaster then pays any member any amount, and the chain sees only a hiding commitment to the (payee, amount) pair and a payment counter. Membership changes go through `rotatePot`, which swaps the root while proving the paymaster still belongs to the *new* set. Nobody watching the chain learns who the members are, who got paid, when a specific person was paid, or how much — yet every payment is publicly verifiable as authorized and membership-correct.

Who uses it: any organization whose payment graph is sensitive —
- **DAOs and open-source projects** paying contributors without exposing identity or rate (pseudonymous contributors are the norm, but today payouts deanonymize them on-chain),
- **Activist, journalistic and NGO organizations** operating where "who receives money from whom" is a security risk,
- **Communities running shared treasuries and splits** (revenue pools, bounties, stipends) that want auditability of *that* payments happened without publishing salary bands,
- **Family offices and private firms** whose vendor/employee lists are competitively sensitive.

For members it is financial privacy; for the sponsor it is provable, self-sovereign disbursement without a trusted payroll processor.

## Why Midnight specifically?
Payroll is the canonical example of data that must be verifiable but not visible. On a transparent chain, every salary payment publishes the org chart, the pay bands, the payment cadence and the relationships between addresses — competitors headhunt your key people by reading your contract, and suppliers or employees get profiled by their payment history. Existing "private payroll" on transparent chains means handing the graph to a trusted processor (a custodial payroll company), which reintroduces exactly the trust blockchain was meant to remove — and still leaks at the settlement layer. Commit-reveal schemes leak timing, sender-linkability and amounts at reveal.

Midnight splits the problem by construction instead of by trust: the coordination facts — a pot exists, its membership set changed, N payments were made, each payment was authorized by the paymaster and directed to a committed member — are public ledger state and `disclose()`d deliberately for auditability. The competitive facts — the member identities (Merkle paths and side bits), the paymaster's key, the payee's key, and every amount — live only as private witnesses inside three Compact circuits. The proof, not an operator, enforces that a payment commitment can only be produced by the real paymaster paying a real member of the committed tree. The result is impossible on a transparent chain and trustworthy only on Midnight: auditable payments, anonymous participants.

## Data Model
| Data Point       | Type           | Disclosed To |
|------------------|----------------|--------------|
| `potRoot` (Merkle root over the member set) | Public ledger  | Everyone — membership *changes* are auditable |
| `paymaster` (commitment binding the distributor) | Public ledger  | Everyone |
| `lastPaymentCommitment` (hiding commitment to (payee, amount)) | Public ledger  | Everyone (as an opaque digest) |
| `paymentCount` (payments executed) | Public ledger  | Everyone |
| `paymasterSecret()` (distributor key) | Private witness | No one |
| `payeeMemberSecret()` (payee key) | Private witness | No one |
| `payeeProofPath()` / `payeeSideBits()` (Merkle auth path) | Private witness | No one |
| `paymentAmount()` | Private witness | No one |
| "payee ∈ committed member tree" | ZK proof | Verified by everyone, contents revealed to no one |
| "payment was authorized by the bound paymaster" | ZK proof | Verified by everyone, key revealed to no one |

## Mainnet Feasibility
Realistic by Level 6. The contract is small and constant-cost by design: three circuits, a fixed-depth-4 Merkle tree (16 leaves) keeps proofs small and proving fast in the browser today — raising the depth scales proof size linearly, not existentially. The browser proving pipeline, wallet signing and indexer reads are network-agnostic and carry over by pointing at mainnet URIs and network IDs. Remaining work is operational and incremental: (1) a mainnet Lace profile with a production proof server and funded deploy wallet, (2) an external audit of the Merkle/commitment logic before real value flows (the correctness is currently pinned by 14 in-process tests against the real compiled circuits), (3) sponsor tooling for safe member-set management — deriving and custodying member secrets is the riskiest UX surface, not the chain layer, and (4) a payee-side "prove my receipt" view built on the existing indexer reads. Honest risks: witness custody mistakes by sponsors (mitigated by tooling and clear key-handling docs), and proof-server availability for mainstream payers (mitigated by local proving fallback). None of these are architectural — the hard part is done and tested.
