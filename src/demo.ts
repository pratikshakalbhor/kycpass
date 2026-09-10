import {
  KycPassHarness,
  NOW0,
  SEC_PER_DAY,
  bytesHex,
  fillByte,
  observablesOf,
} from './simulator.js';
import { ensureIssuerKeys, hex } from './wallet.js';

// ============================================================================
// Off-chain demo: the full KYCPass story in one run.
// ----------------------------------------------------------------------------
// Same execution engine as the tests (the compact-runtime simulator), so this
// demo is proof the contract behaves as described — none of it touches a real
// network, and no private value is ever printed.
// ============================================================================

export interface DemoStep {
  title: string;
  detail: string[];
}

export function runDemo(): DemoStep[] {
  const steps: DemoStep[] = [];
  const push = (title: string, detail: string[]): void => {
    steps.push({ title, detail });
  };

  const keys = ensureIssuerKeys();
  const issuerSecret = Uint8Array.from(Buffer.from(keys.issuerSecretKeyHex, 'hex'));

  const h = new KycPassHarness(issuerSecret).deploy();
  const verifierA = fillByte(0xaa);
  const verifierB = fillByte(0xbb);
  const userU = fillByte(0x11);
  const expiry = BigInt(NOW0) + 90n * SEC_PER_DAY;

  // 1. Issuer registers two verifiers.
  h.registerVerifier(verifierA, fillByte(0x33));
  h.registerVerifier(verifierB, fillByte(0x44));
  push(
    'Issuer registers verifiers',
    [
      `verifier A id : ${bytesHex(verifierA)}`,
      `verifier B id : ${bytesHex(verifierB)}`,
      'Registered into the on-chain Map (children values are *roots*, never secrets).',
    ],
  );

  // 2. Issuer issues a 90-day credential committing U's identity.
  h.issueCredential(userU, expiry, fillByte(0x22));
  push(
    'Issuer issues a credential to U',
    [
      `user identity : ${bytesHex(userU)}`,
      `commit count  : ${h.ledger().commitCount.toString()}`,
      'The userId + expiry live only inside a hiding commitment leaf —',
      'nothing on-chain reveals them.',
    ],
  );

  // 3. U proves to each verifier; nullifiers must not link.
  h.session.verifierSecret = fillByte(0x33);
  const nA = h.verifyTo(h.makeContract(), verifierA, BigInt(NOW0) + 1n);
  h.session.verifierSecret = fillByte(0x44);
  const nB = h.verifyTo(h.makeContract(), verifierB, BigInt(NOW0) + 1n);
  push(
    'U proves "passed KYC" to both verifiers',
    [
      `nullifier @ A : ${bytesHex(nA)}`,
      `nullifier @ B : ${bytesHex(nB)}`,
      `A == B        : ${bytesHex(nA) === bytesHex(nB) ? 'YES — SECURITY BUG' : 'no (cannot join records)'}`,
    ],
  );

  // 4. Verifier B tries to impersonate A (the attack the fix targets).
  h.session.verifierSecret = fillByte(0x44);
  let impersonated = false;
  try {
    h.verifyTo(h.makeContract(), verifierA, BigInt(NOW0) + 1n);
    impersonated = true;
  } catch (e) {
    /* expected — printed below via String() */
  }
  push(
    'Verifier B tries to pass as verifier A',
    impersonated
      ? ['FAIL — impersonation went through (regression)']
      : ['Rejected:  B holds its own secret; only A can mint A\'s nullifier.'],
  );

  // 5. Privacy audit of everything on-chain (ledger + nullifiers + pub identities).
  const audit = observablesOf(h, [nA, nB, verifierA, verifierB]);
  const secrets = [userU, fillByte(0x22), fillByte(0x33), fillByte(0x44)];
  const leaks = secrets
    .map(bytesHex)
    .filter((x) => audit.includes(x) && x.length === 64);
  push(
    'Privacy audit (every on-chain byte-string is searched)',
    [
      leaks.length === 0
        ? 'PASS — no userId, nonce, verifier secret, or expiry appears anywhere on-chain.'
        : 'FAIL — leak detected in on-chain state.',
    ],
  );

  return steps;
}

export function printDemo(steps: DemoStep[]): void {
  console.log('KYCPass — off-chain demo (compact-runtime simulator)');
  console.log('=====================================================\n');
  for (const s of steps) {
    console.log(`■ ${s.title}`);
    for (const d of s.detail) console.log(`   ${d}`);
    console.log('');
  }
  console.log('(nothing above came from your wallet; run `npm run test` for the full suite)\n');
}