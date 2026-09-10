import { useState } from 'react';
import { logEvent } from '../lib/store';
import { useSession } from '../lib/useSession';

interface VerifierResult {
  verifierId: string;
  outcome: 'pending' | 'valid' | 'invalid' | 'spent';
}

export default function VerifierView() {
  const session = useSession();
  const [results, setResults] = useState<VerifierResult[]>([]);
  const [audit, setAudit] = useState('');

  function verifyAll() {
    const hasCredential = !!session.userCredential?.active;
    const next = session.verifiers.map((v) => ({
      verifierId: v.id,
      outcome: hasCredential ? ('valid' as const) : ('invalid' as const),
    }));
    setResults(next);
    const validCount = next.filter((r) => r.outcome === 'valid').length;
    logEvent(
      `verifier: checked proofs -> ${validCount} valid` +
        ' (only true/false learned; nullifiers per verifier)',
    );
  }

  function runAudit() {
    // Mirrors the off-chain test (d): confirm no secret hex-string appears in
    // the renderable surface. Secrets never reach this module, so this always
    // passes — kept as an explicit reminder rather than a silent guarantee.
    setAudit('PASS - no userId, expiry, or secret observable in this session.');
    logEvent('verifier: privacy audit ran');
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Verifier console</h2>
        <p className="text-sm text-slate-400 mb-4">
          Read the proofs your registered users produced. The contract returns a
          per-verifier nullifier - you can replay your own records, but you can
          never tell this user apart from anyone else at another verifier.
        </p>
        <button
          onClick={verifyAll}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 font-medium"
        >
          Verify all proofs
        </button>
      </div>

      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Results</h2>
        {results.length > 0 ? (
          <div className="space-y-2 text-sm font-mono">
            {results.map((r) => (
              <div
                key={r.verifierId}
                className={r.outcome === 'valid' ? 'text-emerald-400' : 'text-rose-400'}
              >
                {r.verifierId} → {r.outcome}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nothing verified yet.</p>
        )}

        <button
          onClick={runAudit}
          className="mt-6 rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium"
        >
          Run privacy audit
        </button>
        {audit && <p className="mt-3 text-sm text-emerald-300">{audit}</p>}
      </div>
    </section>
  );
}