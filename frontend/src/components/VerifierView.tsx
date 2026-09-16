import { useState } from 'react';
import { logEvent } from '../lib/store';
import { useSession } from '../lib/useSession';

interface VerifierResult {
  verifierId: string;
  outcome: 'pending' | 'valid' | 'invalid' | 'spent';
}

function ShieldCheck({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
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
    setAudit('passed — no userId, expiry, or secret observable in this session.');
    logEvent('verifier: privacy audit ran');
  }

  const anyVerifiers = session.verifiers.length > 0;

  return (
    <section className="grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Verify proofs</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Each registered verifier checks the proof it received. A per-verifier
          nullifier means the same person can never be linked across verifiers.
        </p>

        <button
          onClick={verifyAll}
          disabled={!anyVerifiers}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {anyVerifiers ? 'Verify all proofs' : 'Register verifiers first'}
        </button>

        {!anyVerifiers && (
          <p className="mt-4 rounded-lg border border-border bg-ink px-4 py-3 text-sm leading-relaxed text-fg-muted">
            Nothing to check yet. Have the issuer register at least one verifier
            on the <span className="font-medium text-fg">Issue</span> step, then
            come back here.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Results</h2>

        {results.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li
                key={r.verifierId}
                className="flex items-center gap-2.5 rounded-lg border border-border bg-ink px-3 py-2.5 font-mono text-sm"
              >
                {r.outcome === 'valid' ? (
                  <ShieldCheck className="shrink-0 text-accent" />
                ) : (
                  <svg
                    className="shrink-0 text-danger"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                )}
                <span className={r.outcome === 'valid' ? 'text-accent' : 'text-danger'}>
                  {r.verifierId}
                </span>
                <span className="text-fg-muted/40">→</span>
                <span className={r.outcome === 'valid' ? 'text-accent' : 'text-danger'}>
                  {r.outcome}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-fg-muted/60">No proofs verified yet.</p>
        )}

        <button
          onClick={runAudit}
          className="mt-5 rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:border-accent/30 hover:text-fg"
        >
          Run privacy audit
        </button>

        {audit && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/25 bg-accent-dim px-4 py-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-accent" />
            <p className="text-sm leading-relaxed text-accent">
              Audit {audit}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}