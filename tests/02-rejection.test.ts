import { describe, expect, it } from 'vitest';
import {
  KycPassHarness,
  NOW0,
  SEC_PER_DAY,
  commitLeaf,
  fillByte,
  issuerPK,
} from '../src/simulator.js';

describe('KYCPass — expiry & tamper rejection', () => {
  const ISSUER = fillByte(7);
  const USER_U = fillByte(0x11);
  const NONCE_U = fillByte(0x22);
  const EXPIRY_U = BigInt(NOW0) + 90n * SEC_PER_DAY;
  const SECRET_A = fillByte(0x33);
  const VERIFIER_A = fillByte(0xaa);

  it('c) verifier gets true for valid proof, false for expired and tampered credentials', () => {
    // valid proof (already covered by b) → returns a nullifier instead of throwing.
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);
    h.session.verifierSecret = SECRET_A;

    // --- expired: credential issued with a short expiry, checked at a later block time.
    const EXPIRY_SOON = BigInt(NOW0) + 100n;
    h.issueCredential(USER_U, EXPIRY_SOON, NONCE_U);
    h.session.verifierSecret = SECRET_A;
    // freshness bound BELOW expiry but the block time has already passed it.
    expect(() =>
      h.verifyTo(h.makeContract(), VERIFIER_A, EXPIRY_SOON, NOW0 + 200),
    ).toThrow(/Credential has expired/);

    // --- tampered: attacker claims to be a different user while presenting real U's path.
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);
    h.session.verifierSecret = SECRET_A;
    h.session.userSecret = fillByte(0x55); // attacker's identity, not U
    h.pathLeafOverride = commitLeaf(USER_U, EXPIRY_U, NONCE_U); // U's real path
    expect(() =>
      h.verifyTo(h.makeContract(), VERIFIER_A, EXPIRY_U),
    ).toThrow(/Merkle path is not for the prover's credential/);

    // --- tampered: prover without any valid credential at all (no leaf exists).
    const h2 = new KycPassHarness(ISSUER).deploy();
    h2.registerVerifier(VERIFIER_A, SECRET_A);
    h2.session = { userSecret: fillByte(0x25), expiry: EXPIRY_U, nonce: NONCE_U,
      verifierSecret: SECRET_A };
    expect(() =>
      h2.step(h2.makeContract(), 'verifyCredential',
        [issuerPK(ISSUER), VERIFIER_A, BigInt(NOW0) + 1n]),
    ).toThrow(/leaf not in tree/);
  });

  it('freshness bound cannot exceed the private expiry', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);
    h.session.verifierSecret = SECRET_A;

    // revealing a bound ABOVE the real expiry must fail in-circuit.
    expect(() =>
      h.verifyTo(h.makeContract(), VERIFIER_A, EXPIRY_U + 10_000n),
    ).toThrow(/Freshness bound exceeds the credential's expiry/);
  });
});