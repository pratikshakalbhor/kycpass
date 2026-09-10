import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as rt from '@midnight-ntwrk/compact-runtime';

// ============================================================================
// Issuer key management.
// ----------------------------------------------------------------------------
// KYCPass models its operators as keypairs so the demo can run entirely
// locally: the "wallet" here is a file holding an issuer's secret key plus the
// on-chain public identity derived from it (the same persistentHash the
// contract uses). Nothing derived from a secret is ever written anywhere
// except the local state file (gitignored).
//
// * issuerPubKey  — public identity the contract seals at construction.
// * userSecret    — the value a user proves to VERIFIERS as their identity.
// * verifierSecret— the value a verifier proves to the REGISTRY to claim a
//                   verifier id; its root is stored on-chain at registration.
//
// In the browser (frontend) these lives in the user's wallet, never here.
// ============================================================================

export interface IssuerKeys {
  /** issuer's secret key (an arbitrary 32-byte value we treat as a signing key). */
  secretKey: Uint8Array;
  /** the on-chain issuer identity derived from it. */
  pubKey: Uint8Array;
}

export function randomKey(): Uint8Array {
  return crypto.randomBytes(32);
}

export function randomKeyHex(prefix = ''): string {
  return `${prefix}${hex(randomKey())}`;
}

export function issuerPubKeyFor(secretKey: Uint8Array): Uint8Array {
  // Mirrors the contract's computeIssuerPK(): persistentHash(["kyc:issuer:pk:", secret]).
  const domain = new Uint8Array(32);
  domain.set(Buffer.from('kyc:issuer:pk:', 'ascii'), 0);
  return rt.persistentHash(new rt.CompactTypeVector(2, new rt.CompactTypeBytes(32)), [
    domain,
    secretKey,
  ]);
}

export function hex(buf: Uint8Array): string {
  return Buffer.from(buf).toString('hex');
}

export function unhex(hexStr: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hexStr, 'hex'));
}

/** State persisted in the gitignored .midnight-state.json file. */
export interface WalletState {
  issuerSecretKeyHex: string;
  issuerPubKeyHex: string;
}

/** Everything a caller needs about the issuer identity (hex + bytes views). */
export interface IssuerMaterial extends WalletState {
  secretKey: Uint8Array;
  pubKey: Uint8Array;
}

const DEFAULT_STATE_FILE = path.resolve(process.cwd(), '.midnight-state.json');

export function loadWalletState(file = DEFAULT_STATE_FILE): WalletState | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as WalletState;
  } catch {
    return undefined;
  }
}

export function saveWalletState(state: WalletState, file = DEFAULT_STATE_FILE): void {
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}

export function ensureIssuerKeys(file = DEFAULT_STATE_FILE): IssuerMaterial {
  const existing = loadWalletState(file);
  const state: WalletState = existing ?? createFreshState();
  if (!existing) {
    saveWalletState(state, file);
  }
  return toMaterial(state);
}

function createFreshState(): WalletState {
  const secretKey = randomKey();
  return {
    issuerSecretKeyHex: hex(secretKey),
    issuerPubKeyHex: hex(issuerPubKeyFor(secretKey)),
  };
}

function toMaterial(state: WalletState): IssuerMaterial {
  const secretKey = unhex(state.issuerSecretKeyHex);
  return {
    ...state,
    secretKey,
    pubKey: issuerPubKeyFor(secretKey),
  };
}