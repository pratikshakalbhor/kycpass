import * as rt from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  type Ledger,
  type Witnesses,
} from '../managed/KYCCredential/contract/index.js';

// ============================================================================
// Headless simulator harness for KYCCredential.compact
// ----------------------------------------------------------------------------
// Runs the compiled contract through @midnight-ntwrk/compact-runtime, which
// acts as an off-chain simulator of the Midnight execution engine: circuit
// calls mutate the ledger state exactly as they would on-chain, and any failed
// `assert` aborts the call with the assertion message. This lets the CLI
// `demo` flow and the test suite exercise the full
// issue → register → prove → verify lifecycle without a running devnet.
//
// Witness semantics mirror the real wallet model: private inputs (userId,
// expiry, nonce, Merkle path, verifier secret) live in a session object owned
// by the "prover" and are fed to the circuit from there — never logged, never
// persisted in contract state.
// ============================================================================

export const SEC_PER_DAY = 86_400n;

/** constant "now" used as the simulated on-chain block time (seconds). */
export const NOW0 = 1_700_000_000;

export function fillByte(v: number): Uint8Array {
  return new Uint8Array(32).fill(v);
}

export function pad32(text: string): Uint8Array {
  const out = new Uint8Array(32);
  out.set(Buffer.from(text, 'ascii'), 0);
  return out;
}

export function u64ToBytes(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = v;
  for (let i = 7; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function bytesHex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}

const B32 = new rt.CompactTypeBytes(32);
const V2_B32 = new rt.CompactTypeVector(2, B32);
const V3_FIELD = new rt.CompactTypeVector(3, rt.CompactTypeField);

export function secretRoot(secret: Uint8Array): Uint8Array {
  return rt.persistentHash(V2_B32, [pad32('kyc:verifier:'), secret]);
}

export function issuerPK(issuerSecret: Uint8Array): Uint8Array {
  return rt.persistentHash(V2_B32, [pad32('kyc:issuer:pk:'), issuerSecret]);
}

export function commitLeaf(userSecret: Uint8Array, expiry: bigint, nonce: Uint8Array): Uint8Array {
  return rt.persistentCommit(
    V3_FIELD,
    [rt.convertBytesToField(32, userSecret, 'userId'), 1n, expiry],
    nonce,
  );
}

export type Session = {
  userSecret?: Uint8Array;
  expiry?: bigint;
  nonce?: Uint8Array;
  verifierSecret?: Uint8Array;
};

export class KycPassHarness {
  issuerSecret: Uint8Array;
  session: Session = {};
  coinPublicKey: rt.EncodedCoinPublicKey = { bytes: fillByte(3) };
  privateState: object = { phase: 'setup' };
  state!: rt.ChargedState;
  time = NOW0;
  /** when set, the path witness serves the path for THIS leaf (used by tamper tests). */
  pathLeafOverride: Uint8Array | undefined;

  constructor(issuerSecret: Uint8Array) {
    this.issuerSecret = issuerSecret;
  }

  ledger(): Ledger {
    return ledger(this.state);
  }

  sessionLeaf(): Uint8Array {
    const { userSecret, expiry, nonce } = this.session;
    if (!userSecret || !expiry || !nonce) {
      throw new Error('session is not fully populate');
    }
    return commitLeaf(userSecret, expiry, nonce);
  }

  makeContract(overrides: Partial<Witnesses<object>> = {}): Contract<object> {
    return new Contract({
      issuerSecretKey: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, this.issuerSecret],
      commitmentNonce: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, this.session.nonce ?? fillByte(0)],
      userSecretKey: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, this.session.userSecret ?? fillByte(0)],
      credentialExpiry: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, this.session.expiry ?? 0n],
      findCredentialPath: (ctx: rt.WitnessContext<Ledger, object>) => {
        const leaf = this.pathLeafOverride ?? this.sessionLeaf();
        const p = ctx.ledger.credentialTree.findPathForLeaf(leaf);
        if (!p) {
          throw new Error('leaf not in tree');
        }
        return [ctx.privateState, p];
      },
      verifierSecret: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, this.session.verifierSecret ?? fillByte(0)],
      ...overrides,
    } as Witnesses<object>);
  }

  ctx(time = this.time): rt.CircuitContext<object> {
    return rt.createCircuitContext(
      rt.dummyContractAddress(),
      this.coinPublicKey,
      this.state,
      this.privateState,
      undefined,
      rt.CostModel.initialCostModel(),
      time,
    );
  }

  step<R>(
    contract: Contract<object>,
    circuit: keyof Contract<object>['impureCircuits'],
    args: unknown[],
    time = this.time,
  ): rt.CircuitResults<object, R> {
    const fn = contract.impureCircuits[circuit] as (
      ...a: unknown[]
    ) => rt.CircuitResults<object, R>;
    const res = fn(this.ctx(time), ...args);
    this.state = res.context.currentQueryContext.state;
    return res;
  }

  deploy(): this {
    const result = this.makeContract().initialState({
      initialPrivateState: this.privateState,
      initialZswapLocalState: rt.emptyZswapLocalState(this.coinPublicKey),
    });
    this.state = result.currentContractState.data;
    this.privateState = result.currentPrivateState;
    return this;
  }

  registerVerifier(id: Uint8Array, secret: Uint8Array, issuer?: Uint8Array): void {
    const c = issuer
      ? this.makeContract({ issuerSecretKey: (ctx: rt.WitnessContext<Ledger, object>) => [ctx.privateState, issuer] })
      : this.makeContract();
    this.step(c, 'registerVerifier', [id, secretRoot(secret)]);
  }

  issueCredential(userSecret: Uint8Array, expiry: bigint, nonce: Uint8Array): void {
    this.session = { userSecret, expiry, nonce };
    this.pathLeafOverride = undefined;
    this.step(this.makeContract(), 'commitCredential', []);
  }

  verifyTo(
    contract: Contract<object>,
    verifierId: Uint8Array,
    freshUntil: bigint,
    time = this.time,
  ): Uint8Array {
    const res = this.step<Uint8Array>(
      contract,
      'verifyCredential',
      [issuerPK(this.issuerSecret), verifierId, freshUntil],
      time,
    );
    return res.result;
  }
}

export function observablesOf(h: KycPassHarness, extra: Uint8Array[]): string {
  const l: Ledger = ledger(h.state);
  const parts: string[] = [];
  parts.push(bytesHex(l.issuerPubKey));
  parts.push(`count=${l.commitCount.toString(16)}`);
  try {
    for (const [k, v] of l.registeredVerifiers) {
      parts.push(bytesHex(k), bytesHex(v));
    }
  } catch {
    /* empty map — nothing to read */
  }
  const root = l.credentialTree.root();
  parts.push(root.field.toString(16));
  for (const b of extra) parts.push(bytesHex(b));
  return parts.join('|');
}