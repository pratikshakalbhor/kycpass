import { useState } from 'react';
import { connectorWallet, isConnectorInstalled } from '../lib/midnight';
import { getSecret, logEvent } from '../lib/store';
import { useSession } from '../lib/useSession';

const BOUND_SECONDS: Record<string, number> = {
  '10m': 600,
  '1h': 3600,
  '24h': 86400,
};

export default function UserView() {
  const session = useSession();
  const [freshUntil, setFreshUntil] = useState('1h');
  const [proofRequested, setProofRequested] = useState(false);
  const wallet = connectorWallet();

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
    if (!wallet) {
      logEvent('user: wallet absent — cannot finalize proof');
      return;
    }
    logEvent('user: proof sent to wallet for signing + encryption per verifier');
  }

  return (
    <section className="bg-slate-900 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">User prove-view</h2>
      <p className="text-sm text-slate-400 mb-6">
        You hold a credential from the issuer. Proving it to a verifier reveals{' '}
        <em>nothing but “passed + not expired”</em>. Your identity digest is{' '}
        <code className="font-mono text-slate-300">
          {session.userCredential ? session.userCredential.handle.short : '(no credential yet)'}
        </code>
        …
      </p>

      <div className="flex items-end gap-4 mb-6">
        <label className="block">
          <span className="text-xs text-slate-400">Reveal "valid at most until"</span>
          <select
            value={freshUntil}
            onChange={(e) => setFreshUntil(e.target.value)}
            className="mt-1 block rounded-lg bg-slate-800 px-3 py-2 text-sm"
          >
            <option value="10m">10 minutes</option>
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
          </select>
        </label>
        <button
          disabled={!session.userCredential}
          onClick={generateProof}
          className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2 font-medium"
        >
          Generate proof
        </button>
        {proofRequested && (
          <button
            disabled={!isConnectorInstalled()}
            onClick={signInWallet}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 font-medium"
          >
            Sign in wallet
          </button>
        )}
      </div>

      {proofRequested ? (
        <p className="text-sm text-slate-300">
          Proof ready (off-chain part). Finalizing requires the wallet — the same
          session can later encrypt one copy of the result per verifier.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          Uses the Merkle proof of your credential's leaf and an expiry proof that
          holds below {freshUntil}. Next: <strong>Verifier</strong> tab.
        </p>
      )}
    </section>
  );
}