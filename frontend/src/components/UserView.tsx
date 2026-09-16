import { useState } from 'react';
import { getSecret, logEvent, getConnectedApi } from '../lib/store';
import { useSession } from '../lib/useSession';

const BOUND_SECONDS: Record<string, number> = {
  '10m': 600,
  '1h': 3600,
  '24h': 86400,
};

function ShieldCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export default function UserView() {
  const session = useSession();
  const [freshUntil, setFreshUntil] = useState('1h');
  const [proofRequested, setProofRequested] = useState(false);
  const walletConnected = session.wallet !== 'demo';
  const hasCredential = !!session.userCredential;

  function boundSeconds(): number {
    // The revealed freshness bound — kept just past "now" to minimize disclosure.
    const now = Math.floor(Date.now() / 1000);
    return now + (BOUND_SECONDS[freshUntil] ?? 3600);
  }

  function generateProof() {
    // Real proving happens inside the wallet (zk) — this demo exposes only the
    // *request* surface. The private inputs (user secret, expiry, Merkle path)
    // are never rendered, logged, or persisted.
    const userSecret = getSecret(session.userSecretId);
    void userSecret; // held in memory only
    const bound = boundSeconds();
    setProofRequested(true);
    logEvent(
      `user: proof generated (freshness bound ${bound} — reveals only "valid ≤ now+${freshUntil}")`,
    );
  }

  function signInWallet() {
    if (!walletConnected) {
      logEvent('user: demo mode — connect a real wallet to sign and encrypt');
      return;
    }
    const api = getConnectedApi();
    if (!api) {
      logEvent('user: wallet absent — cannot finalize proof');
      return;
    }
    logEvent('user: proof sent to wallet for signing + encryption per verifier');
  }

  return (
    <section className="mx-auto max-w-xl">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Generate a proof</h2>

        {hasCredential ? (
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            Your credential digest is{' '}
            <code className="font-mono text-xs text-fg">
              {session.userCredential!.handle.short}…
            </code>
            . Proving it reveals <em className="text-fg">nothing</em> but
            “passed + not expired”.
          </p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            You don't hold a credential yet. Go to the{' '}
            <span className="font-medium text-fg">Issue</span> step and run a KYC
            with the issuer first — you'll return here to prove it.
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-fg-muted">
              Reveal “valid at most until”
            </span>
            <select
              value={freshUntil}
              onChange={(e) => setFreshUntil(e.target.value)}
              className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-fg transition-colors focus:border-accent"
            >
              <option value="10m">10 minutes</option>
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
            </select>
          </label>

          <button
            disabled={!hasCredential}
            onClick={generateProof}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate proof
          </button>

          {proofRequested && (
            <button
              disabled={session.wallet === 'demo'}
              onClick={signInWallet}
              className="rounded-lg border border-border bg-surface-raised px-5 py-2 text-sm font-medium text-fg transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {session.wallet === 'demo' ? 'Demo only — connect wallet to sign' : 'Sign in wallet'}
            </button>
          )}
        </div>

        {proofRequested ? (
          <div className="mt-6 rounded-lg border border-accent/25 bg-accent-dim px-5 py-4">
            <div className="flex items-center gap-2.5 text-accent">
              <ShieldCheck />
              <span className="text-sm font-semibold">Proof generated</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              Your private inputs — userId, expiry, Merkle path — were never
              exposed. To finalize, sign in your wallet, which encrypts one copy
              of the result per verifier.
            </p>
          </div>
        ) : (
          hasCredential && (
            <p className="mt-4 text-xs leading-relaxed text-fg-muted/60">
              Uses a Merkle proof of your credential's leaf and an expiry proof
              that holds below {freshUntil}. Next was the{' '}
              <span className="font-medium text-fg-muted">Verify</span> step.
            </p>
          )
        )}
      </div>
    </section>
  );
}