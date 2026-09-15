# KYCPass

## 1. Project Description

KYCPass lets a user prove **"I passed KYC with Issuer X, and my credential is
currently active"** to any number of verifiers **without revealing who they
are, when the credential expires, or anything else**. The issuer issues a
private credential; the user generates a zero-knowledge proof from it; the
verifier receives only a **true/false** answer plus a verifier-specific
nullifier (a payment-anchor-style value) to stop the same proof from being
reused across verifier records.

Built on **Midnight** (Compact smart contracts, data protection by default) —
the whole system is a proof-of-concept for regulated industries that must
"KYC once, prove to many" without turning one bank's KYC check into a
privacy-destroying data broker.

```
Issuer  ──(issue)──►  User  ──(zk-proof)──►  Verifier A : true/false + nullifier_A
                                   └──────►  Verifier B : true/false + nullifier_B
                                   (A and B cannot link the two proofs to
                                    the same person — see §5 attack notes)
```

## 2. Project Vision

### Why this exists — the privacy story in plain English

Today "prove you're KYC'd" usually means "show the bank your passport, your
driving licence, your utility bill — again, to every single new partner."
Every copy of a document is a data breach waiting to happen, and it lets
companies that have nothing to do with each other build a profile of your
life.

KYCPass inverts the model. One trusted issuer (say, a bank or a telecom) runs
a single KYC on you. From then on, you hold a **private credential** — a value
that lives only in your wallet. When a verifier asks "are you KYC'd?", you
generate a **zero-knowledge proof** that answers exactly that one question and
literally **does not contain** your name, ID, or date of birth. The verifier's
system checks the proof and learns a single fact: *true* or *false* — which
Midnight then encrypts back to the verifier. No data to leak, no cross-company
profile, no way to tell that the same person asked Bank A and Bank B.

### What privacy actually means here (and where it ends)

- **Your identity never leaves your wallet.** Not in the proof, not in the
  on-chain state, not in the demo logs.
- **Your expiry never leaves your wallet.** The verifier learns only that the
  credential is *currently* valid; if it is time-limited, the on-chain check
  proves "not expired" without revealing the expiry date.
- **Two verifiers cannot join their records.** The proof binds a
  verifier-specific nullifier, so a user proving to Bank A and Bank B looks
  like two different people.
- **Public = leaked.** The one thing every chain observer can see is the
  issuer's public key and that *some* number of credentials have been issued.

### `Project Vision` continued — a real-world parallel

Midnight's "data protection by default" is to today's KYC what encrypted
messaging was to postcards. The contract in this repo is deliberately small —
one issuer, one binary claim — because the *shape* of the fix matters more
than the feature list: **data minimization, not document sharing**.

## 3. Smart Contract Deployment

The contract is `contracts/KYCCredential.compact`; it compiles to three
exported circuits under `managed/KYCCredential`.

**Deployed contract address:** `[PENDING — run `npm run cli -- deploy --network preview` /
`npm run frontend:dev` and paste the address here]`

### Deployment steps

```bash
npm run setup        # one-time: deps, compile, issuer keypair, .env
npm run cli -- setup # or run setup pieces interactively
npm run cli -- deploy      # targets the local devnet (see §8)
npm run cli -- deploy --network preview  # targets the public Preview network
```

**Status (verified this session):** the Preview RPC is reachable
(`node reachable: yes`), so the remaining blocker is purely the operator
wallet. Deployment truly needs a **funded wallet** (the operator's wallet from
the frontend). The CLI will not (and must not) fabricate an address, so it
stops with explicit instructions instead. On Preview, fund the operator address
with test MID from the Preview faucet. Note the frontend's **"Deploy contract"**
button is currently a *stub* that records a pasted address into
`.env` (`VITE_CONTRACT_ADDRESS`) — driving a real deployment through the
DApp Connector is not wired yet (see §5 Current Limitations); a deployed
contract address therefore does not yet exist for this project.

## 4. Key Features

| Feature | What it does | Where |
|---|---|---|
| Private credential issuance | Issuer commits a *hiding* on-chain commitment (Merkle leaf with commitment nonce); userId + expiry live only inside it | `commitCredential` |
| Zero-knowledge proof of membership + validity | User proves "leaf exists in this tree, it's mine, it's not expired" — no inputs revealed | `verifyCredential` |
| Per-verifier unlinkable nullifier | Nullifier is a hash of user secret + **verifier id + that verifier's secret** | `verifyCredential` |
| Verifier registry, issuer-controlled | Only the issuer can register verifiers; secrets are stored as roots, never as keys | `registerVerifier` |
| Freshness bound | User reveals only "valid at most until my expiry" — raw expiry stays off-chain | `verifyCredential` |
| Simulator + CLI demo | The full lifecycle runs headlessly (`npm run cli -- demo`) or in 7 vitest tests | `tests/`, `src/` |
| Privacy test lock | Asserts no userId / nonce / secret / leaf / expiry hex appears in any output or state | test (d) |

## 5. Out of Scope

- **Revocation feed.** A revoked credential stays technically valid until its
  expiry. Real deployments add an issuer-signed revocation list.
- **Multiple issuers.** The ledger seals one issuer public key at construction.
- **KYC tiers / document provenance.** Only the single claim "passed" exists,
  no grades, no source documents.
- **Real regulated-identity issuance.** The issuer is a demo keypair; real KYC
  belongs to a licensed operator behind proper checks.
- **Duplicate-issuance prevention.** The contract trusts the issuer not to
  mint two credentials for the same person under different sessions — a
  process-level guarantee, not a cryptographic one.
- **Identity of the caller / `msg.sender`.** Compact 0.5.1 has **no caller
  primitive** (`kernel.caller()` doesn't compile). Operator *authority* is
  modeled by secrets (issuer secret, verifier secret) the circuits check in
  zero knowledge — never by assuming the caller is whom they claim.

### Current Limitations (frontend)

- **The frontend is a local demo, not a live DApp yet.** It only *detects* the
  Midnight DApp Connector (`window.midnight`) and can request Preview test MID
  through the wallet's faucet API. The issuer / user / verifier views mutate an
  **in-memory session only** — no transaction is submitted to a chain, no
  indexer is queried, and no real zk proof is produced or verified in the
  browser. The "Deploy contract" button is a stub that records a pasted address
  into `.env`; it does not drive a real deployment through the wallet.
  Real proving / verifying / deploying through the wallet + indexer is future
  work (see §6).

## 6. Future Scope

- Public-key-revocation (accumulator / revocation epoch) without per-user
  on-chain records.
- Multiple issuer profiles and a verifiable identity®-style credential format.
- KYC rating tiers proven as ranges, not booleans.
- Real wallet + DApp Connector flows with the contract address resolved from
  the registry instead of `.env`.
- Off-chain state rehydration from the indexer so the demo survives restarts.

## 7. Tech Stack

- **Language / toolchain:** Compact (Midnight's type-theoretic smart-contract
  language), compact CLI `0.5.1`, `@midnight-ntwrk/compact-runtime@0.16.0`
  (off-chain headless simulator), `@midnight-ntwrk/onchain-runtime-v3@3.1.1`.
- **Tests:** vitest `3.x` — 7 tests incl. a private-inputs-never-exposed audit
  and a cross-verifier-correlation test.
- **Runtime:** Node.js `>= 20` (dev on `22`), TypeScript `5.x`, `tsx`.
- **Local devnet:** `docker compose` — `midnight-node`, `midnight-indexer`,
  `midnight-proof-server` (`midnightnetwork/*:latest` images).
- **Frontend:** Vite + React 18 + TypeScript + Tailwind 4. The Midnight DApp
  Connector is *detected* (for faucet requests only); the live indexer /
  deployed-contract wiring is not implemented yet — see §5 Current Limitations.

## 8. Local Development

```bash
git clone <this-repo> && cd MVP       # or open as-is
npm install
npm run lint                          # tsc --noEmit (strict)
npm run test                          # compiles first, then vitest run (7 specs)
npm run cli -- demo                   # full issue→register→prove→verify, off-chain
docker compose up -d                  # local devnet (node :9944, indexer :8088)
npm run cli -- status                 # health-check the network
npm run cli -- deploy                 # deploy + handoff (needs funded wallet)
```

The headless simulator (`src/simulator.ts`) is the same engine vitest and the
`demo` command run — no network, no faucet, provable in CI.

The test suite is split by concern:

- `tests/01-issuer-commit.test.ts` — (3) issuance into the Merkle tree, valid
  proof generation, and issuer-controlled / duplicate-rejecting verifier
  registration.
- `tests/02-rejection.test.ts` — (2) expired-credential and tampered-path
  rejection, and freshness-bound-must-not-exceed-expiry.
- `tests/03-privacy-unlinkability.test.ts` — (2) the privacy-leak audit
  (test d: no userId, expiry, Merkle path, nonce, or secret hex appears in any
  output/state) and the cross-verifier correlation-rejection regression
  (test e: two verifiers cannot join records, and verifier impersonation /
  nullifier borrowing is rejected in-circuit).

### Where things live

```
contracts/   KYCCredential.compact      (the smart contract)
managed/     compiled artifact (gitignored, regenerated by `npm run compile`)
src/         network, wallet, setup, deploy, cli, demo, simulator
tests/       01-issuer-commit (3) + 02-rejection (2) + 03-privacy-unlinkability (2)
             — 7 specs incl. the privacy-leak audit (d) and the cross-verifier
             correlation-rejection regression (e); see §8 note below
frontend/    Vite + React + Tailwind — local demo; DApp Connector detection only,
             live indexer wiring not yet implemented (see §5 Current Limitations)
compose.yml  local devnet (node / indexer / proof-server)
```

## 9. Privacy & Security Notes

The security model is written into the contract and **regression-tested**:

1. **The nullifier-borrowing attack (fixed).** A malicious verifier *B* could
   originally take another user's proof value and present it as *their own*
   verifier's output. Now the nullifier is bound to the *registered* verifier
   id + that verifier's secret via a state-map membership check. Test (e)
   proves B cannot mint A's nullifier with B's own or a forged secret.
2. **No private value ever becomes public.** Tests scan the full observable
   transcript (ledger + nullifiers + public inputs) for the userId, nonce,
   verifier secret, leaf, and expiry bytes — a single match fails the suite.
3. **The expiry is disclosed only as an upper bound.** `blockTimeLt` forces a
   `disclose()` in this toolchain, so the contract proves
   `blockTime < revealedFreshUntil ≤ expiry` and reveals only
   `revealedFreshUntil` (chosen by the user, just past block time).
4. **Honest boundaries.** Where the toolchain physically can't do something
   (caller identity, off-chain expiry reads), the contract says so in a
   comment rather than pretending — and the deploy CLI refuses to invent a
   contract address.