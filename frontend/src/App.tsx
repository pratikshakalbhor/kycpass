import { isConnectorInstalled, network } from './lib/midnight';
import { useSession } from './lib/useSession';
import WalletConnect from './components/WalletConnect';
import IssuerView from './components/IssuerView';
import UserView from './components/UserView';
import VerifierView from './components/VerifierView';

type Tab = 'wallet' | 'issuer' | 'user' | 'verifier';

const TABS: { id: Tab; label: string }[] = [
  { id: 'wallet', label: 'Wallet / Deploy' },
  { id: 'issuer', label: 'Issuer' },
  { id: 'user', label: 'User' },
  { id: 'verifier', label: 'Verifier' },
];

export default function App() {
  const session = useSession();
  const active = (window.location.hash.replace('#', '') || 'wallet') as Tab;
  const tab: Tab = TABS.some((t) => t.id === active) ? active : 'wallet';

  return (
    <div className="min-h-screen max-w-5xl mx-auto px-6 py-8">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">KYCPass</h1>
            <p className="text-slate-400 text-sm mt-1">
              Prove “KYC passed” — without revealing who you are.
            </p>
          </div>
          <div className="text-right text-xs text-slate-400">
            <div>
              network: <span className="text-slate-200 font-mono">{network}</span>
            </div>
            <div className={session.connectorInstalled ? 'text-emerald-400' : 'text-amber-400'}>
              {session.connectorInstalled
                ? 'wallet connected (DApp Connector)'
                : 'no wallet — demo mode'}
            </div>
          </div>
        </div>
        <nav className="mt-6 flex gap-2 border-b border-slate-800 pb-px">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              className={`px-4 py-2 rounded-t text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'wallet' && <WalletConnect />}
        {tab === 'issuer' && <IssuerView />}
        {tab === 'user' && <UserView />}
        {tab === 'verifier' && <VerifierView />}
      </main>

      {session.eventLog.length > 0 && (
        <footer className="mt-12">
          <h3 className="text-sm text-slate-400 uppercase tracking-wide mb-2">Event log</h3>
          <ul className="space-y-1 text-xs font-mono text-slate-500">
            {session.eventLog.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </footer>
      )}
    </div>
  );
}