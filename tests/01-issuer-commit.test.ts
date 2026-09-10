import { describe, expect, it } from 'vitest';
import {
  KycPassHarness,
  NOW0,
  SEC_PER_DAY,
  bytesHex,
  fillByte,
} from '../src/simulator.js';

describe('KYCPass — issuer & credential issuance', () => {
  const ISSUER = fillByte(7);
  const USER_U = fillByte(0x11);
  const NONCE_U = fillByte(0x22);
  const EXPIRY_U = BigInt(NOW0) + 90n * SEC_PER_DAY;
  const SECRET_A = fillByte(0x33);
  const SECRET_B = fillByte(0x44);
  const VERIFIER_A = fillByte(0xaa);

  it('a) issuer can commit a valid credential into the Merkle tree', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    const before = h.ledger().credentialTree.root();

    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);

    const l = h.ledger();
    expect(l.commitCount).toBe(1n);
    expect(l.credentialTree.firstFree()).toBe(1n);
    expect(l.credentialTree.findPathForLeaf(h.sessionLeaf())).toBeDefined();
    expect(l.credentialTree.root().field).not.toBe(before.field);
  });

  it('b) user can generate a valid proof from a valid, non-expired credential', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);
    h.session.verifierSecret = SECRET_A;

    const n1 = h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n);
    expect(n1).toHaveLength(32);
    // deterministic per (user, verifier, secret) → usable as a replay anchor at THIS verifier
    const n2 = h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n);
    expect(bytesHex(n2)).toBe(bytesHex(n1));
    expect(bytesHex(n1)).not.toBe('0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('registerVerifier is issuer-controlled and rejects duplicates', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);

    // an unrelated caller (wrong issuer key) cannot register
    expect(() => h.registerVerifier(fillByte(0xcc), SECRET_B, fillByte(0x99)))
      .toThrow(/Caller is not the registered issuer/);

    // a second registration of the same id cannot overwrite the existing entry
    expect(() => h.registerVerifier(VERIFIER_A, SECRET_A)).toThrow(
      /Verifier ID is already registered/,
    );
  });
});