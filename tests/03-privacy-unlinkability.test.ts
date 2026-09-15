import { describe, expect, it } from 'vitest';
import {
  KycPassHarness,
  NOW0,
  SEC_PER_DAY,
  bytesHex,
  fillByte,
  issuerPK,
  observablesOf,
  u64ToBytes,
} from '../src/simulator.js';

describe('KYCPass — privacy: no private input ever leaks; verifiers cannot link', () => {
  const ISSUER = fillByte(7);
  const USER_U = fillByte(0x11);
  const NONCE_U = fillByte(0x22);
  const EXPIRY_U = BigInt(NOW0) + 90n * SEC_PER_DAY;
  const SECRET_A = fillByte(0x33);
  const SECRET_B = fillByte(0x44);
  const VERIFIER_A = fillByte(0xaa);
  const VERIFIER_B = fillByte(0xbb);

  it('d) no userId, expiry, Merkle path, or secret appears in any output/state', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);
    h.session.verifierSecret = SECRET_A;
    const nullifier = h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n);

    // everything an on-chain observer (or the simulator) can see:
    const observable = observablesOf(h, [nullifier, issuerPK(ISSUER), VERIFIER_A]);

    // the credential LEAF is a hiding commitment — it must not equal the nullifier either.
    const leaf = h.sessionLeaf();
    expect(bytesHex(leaf)).not.toBe(bytesHex(nullifier));

    expect(observable).not.toContain(bytesHex(USER_U)); // userId
    expect(observable).not.toContain(bytesHex(NONCE_U)); // commitment nonce
    expect(observable).not.toContain(bytesHex(ISSUER)); // issuer secret key
    expect(observable).not.toContain(bytesHex(SECRET_A)); // verifier secret
    expect(observable).not.toContain(bytesHex(leaf)); // leaf commitment
    expect(observable).not.toContain(bytesHex(u64ToBytes(EXPIRY_U))); // expiry timestamp
  });

  it('e) cross-verifier correlation is prevented / verifier impersonation is rejected', () => {
    const h = new KycPassHarness(ISSUER).deploy();
    h.registerVerifier(VERIFIER_A, SECRET_A);
    h.registerVerifier(VERIFIER_B, SECRET_B);
    h.issueCredential(USER_U, EXPIRY_U, NONCE_U);

    // the SAME user proves to two different verifiers:
    h.session.verifierSecret = SECRET_A;
    const nullifierA = h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n);
    h.session.verifierSecret = SECRET_B;
    const nullifierB = h.verifyTo(h.makeContract(), VERIFIER_B, BigInt(NOW0) + 1n);

    // the two nullifiers differ → A cannot match B's value, so they cannot join records.
    expect(bytesHex(nullifierA)).not.toBe(bytesHex(nullifierB));

    // THE ATTACK: verifier B attempts to pass verifier A's identity.
    // B holds only its OWN secret — the circuit must reject the impersonation.
    h.session.verifierSecret = SECRET_B;
    expect(() =>
      h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n),
    ).toThrow(/Prover does not hold this verifier's registered secret/);

    // even with a random/forged secret the same rejection happens (never A's nullifier).
    h.session.verifierSecret = fillByte(0x99);
    expect(() =>
      h.verifyTo(h.makeContract(), VERIFIER_A, BigInt(NOW0) + 1n),
    ).toThrow(/Prover does not hold this verifier's registered secret/);

    // B can only ever obtain B's own nullifier:
    h.session.verifierSecret = SECRET_B;
    expect(bytesHex(h.verifyTo(h.makeContract(), VERIFIER_B, BigInt(NOW0) + 1n)))
      .toBe(bytesHex(nullifierB));

    // an entirely unregistered verifierId is rejected before any nullifier exists.
    expect(() =>
      h.verifyTo(h.makeContract(), fillByte(0xee), BigInt(NOW0) + 1n),
    ).toThrow(/Verifier is not registered on-chain/);
  });
});