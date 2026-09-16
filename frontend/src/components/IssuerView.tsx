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
    setNotice('Verifier registered — only the public digest is stored on-chain.');
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
    setNotice('Credential issued. A hiding commitment leaf is on-chain — your identity stays private.');
  }

  return (
    <section className="grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Register a verifier</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Only the issuer can add verifiers. Each verifier receives a secret that
          binds its nullifier, so two verifiers can never link the same user.
        </p>

        <div className="mt-5 flex gap-2">
          <input
            value={verifierName}
            onChange={(e) => setVerifierName(e.target.value)}
            placeholder="e.g. bank-a"
            className="flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm text-fg placeholder:text-fg-muted/50 transition-colors focus:border-accent"
          />
          <button
            onClick={registerVerifier}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
          >
            Register
          </button>
        </div>

        {session.verifiers.length > 0 && (
          <ul className="mt-5 space-y-2">
            {session.verifiers.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-ink px-3 py-2 font-mono text-sm text-fg-muted"
              >
                <span className="text-fg">{v.id}</span>
                <span className="text-fg-muted/40">→</span>
                <span>{v.handle.short}…</span>
                <span className="ml-auto font-sans text-[11px] font-medium text-accent">
                  registered
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Issue a credential</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Issue a 90-day private credential to the demo user. Only a hiding
          commitment reaches the chain — the userId and expiry never do.
        </p>

        <div className="mt-5 flex items-center gap-2 font-mono text-xs text-fg-muted">
          <span>issuer</span>
          <span className="rounded-md bg-ink border border-border px-2 py-1 text-fg">
            {session.issuerPublic}
          </span>
        </div>

        <button
          onClick={issueCredential}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
        >
          Issue credential
        </button>

        {notice && (
          <div className="mt-5 rounded-lg border border-accent/25 bg-accent-dim px-4 py-3 text-sm leading-relaxed text-accent">
            {notice}
          </div>
        )}

        {session.userCredential && (
          <div className="mt-5 flex items-center gap-2 text-xs font-medium text-accent">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            Credential issued — active for 90 days
          </div>
        )}
      </div>
    </section>
  );
}