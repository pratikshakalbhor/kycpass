import { useSession } from './lib/useSession';
import LandingPage from './components/LandingPage';
import WalletIndicator from './components/WalletIndicator';
import WalletConnect from './components/WalletConnect';
import IssuerView from './components/IssuerView';
import UserView from './components/UserView';
import VerifierView from './components/VerifierView';

type Tab = 'wallet' | 'issuer' | 'user' | 'verifier';

const STEPS: { id: Tab; num: number; label: string; sub: string }[] = [
  { id: 'wallet', num: 1, label: 'Connect', sub: 'Wallet & Deploy' },
  { id: 'issuer', num: 2, label: 'Issue', sub: 'Credentials' },
  { id: 'user', num: 3, label: 'Prove', sub: 'Your proof' },
  { id: 'verifier', num: 4, label: 'Verify', sub: 'Results' },
];

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

export default function App() {
  const session = useSession();

  if (session.wallet === null) {
    return <LandingPage />;
  }

  const active = (window.location.hash.replace('#', '') || 'wallet') as Tab;
  const tab: Tab = STEPS.some((s) => s.id === active) ? active : 'wallet';
  const activeIdx = STEPS.findIndex((s) => s.id === tab);

  return (
    <div className="min-h-screen max-w-4xl mx-auto px-5 py-8 sm:px-8">
      <header className="mb-9 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.375rem] font-semibold tracking-tight text-fg">
            KYCPass
          </h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            Prove “KYC passed” — without revealing who you are.
          </p>
        </div>
        <WalletIndicator />
      </header>

      <nav aria-label="Progress" className="mb-10">
        <ol className="flex items-center">
          {STEPS.map((step, i) => {
            const isCurrent = step.id === tab;
            const isPast = i < activeIdx;
            return (
              <li key={step.id} className="contents">
                {i > 0 && (
                  <div
                    className={`mx-1 flex-1 h-px sm:mx-2 ${
                      i <= activeIdx + 1 ? 'bg-accent/40' : 'bg-border'
                    }`}
                    aria-hidden="true"
                  />
                )}
                <a
                  href={`#${step.id}`}
                  aria-label={`${step.label}${step.sub ? ` — ${step.sub}` : ''}`}
                  aria-current={isCurrent ? 'step' : undefined}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-8 sm:w-8 sm:text-sm ${
                      isCurrent
                        ? 'bg-accent text-ink'
                        : isPast
                          ? 'bg-accent/15 text-accent'
                          : 'border border-border bg-surface text-fg-muted group-hover:border-fg-muted/40'
                    }`}
                  >
                    {isPast ? <CheckIcon /> : step.num}
                  </div>
                  <span
                    className={`text-[11px] font-medium sm:text-xs ${
                      isCurrent ? 'text-fg' : 'text-fg-muted'
                    }`}
                  >
                    {step.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <main>
        {tab === 'wallet' && <WalletConnect />}
        {tab === 'issuer' && <IssuerView />}
        {tab === 'user' && <UserView />}
        {tab === 'verifier' && <VerifierView />}
      </main>

      {session.eventLog.length > 0 && (
        <footer className="mt-14 border-t border-border pt-6">
          <h3 className="mb-3 text-xs font-medium text-fg-muted">Event log</h3>
          <ul className="space-y-1 text-[11px] font-mono text-fg-muted/60">
            {session.eventLog.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </footer>
      )}
    </div>
  );
}