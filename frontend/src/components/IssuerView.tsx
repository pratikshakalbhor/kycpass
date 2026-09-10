import { useEffect, useState } from 'react';
import {
  issuerPublicId,
  logEvent,
  makeHandle,
  mutate,
  getSession,
} from '../lib/store';
import { useSession } from '../lib/useSession';

export default function IssuerView() {
  const session = useSession();
  const [verifierName, setVerifierName] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void issuerPublicId(session.issuerSecretId).then((id) => {
      mutate((s) => {
        s.issuerPublic = id;
      });
    });
  }, [session.issuerSecretId]);

  async function registerVerifier() {
    const name = verifierName.trim() || `verifier-${session.verifiers.length}`;
    if (!session.verifiers.length) {
      getSession();
    }
    const handle = await makeHandle(`verifier:${name}`);
    mutate((s) => {
      s.verifiers = [...s.verifiers, { id: name, handle, registered: true }];
    });
    logEvent(`issuer: registered verifier "${name}" (public id ${handle.short}…)`);
    setNotice('Verifier registered on-chain (digest only — secret never leaves the issuer).');
    setVerifierName('');
  }

  async function issueCredential() {
    if (!session.userCredential) {
      const handle = await makeHandle(session.userSecretId);
      mutate((s) => {
        s.userCredential = {
          handle,
          issuedAt: Date.now(),
          expiresAt: Date.now() + 90 * 24 * 3600 * 1000,
          active: true,
        };
      });
    }
    logEvent(
      `issuer: committed credential for user ${session.userCredential?.handle.short ?? ''}…` +
        ' (leaf is a hiding commitment; expiry stays private)',
    );
    setNotice('Credential issued and committed to the Merkle tree. No user identity is on-chain.');
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Issuer console</h2>
        <p className="text-sm text-slate-400 mb-4">
          The issuer runs the only real KYC. Its public identity is{' '}
          <code className="font-mono text-slate-300">{session.issuerPublic}</code>
          (a hash — the underlying key lives only in this tab's memory).
        </p>

        <h3 className="text-sm text-slate-400 mb-2">Register a verifier</h3>
        <div className="flex gap-2">
          <input
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            placeholder="e.g. bank-a"
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none focus:ring-2 ring-sky-500"
          />
          <button
            onClick={registerVerifier}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-sm font-medium"
          >
            Register
          </button>
        </div>

        {session.verifiers.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm font-mono text-slate-400">
            {session.verifiers.map((v) => (
              <li key={v.id}>
                {v.id} → {v.handle.short}… <span className="text-emerald-400">(registered)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-slate-900 rounded-xl p-6">
        <h3 className="text-sm text-slate-400 mb-2">Issue a credential</h3>
        <p className="text-sm text-slate-400 mb-4">
          Issues a 90-day private credential to the demo user. Only a hiding
          commitment leaf reaches the chain.
        </p>
        <button
          onClick={issueCredential}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-medium"
        >
          Issue credential to user
        </button>
        {notice && <p className="mt-4 text-sm text-slate-300">{notice}</p>}
      </div>
    </section>
  );
}