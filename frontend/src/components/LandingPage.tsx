import { useState } from 'react';
import {
  connectWallet,
  listWallets,
  network,
  networkIdForApp,
  readConnection,
  type MidnightWallet,
} from '../lib/midnight';
import { setConnectedApi, setDemoMode, setWallet } from '../lib/store';

type Phase = 'idle' | 'picking' | 'connecting' | 'no-wallet' | 'error';

const STEPS = [
  {
    title: 'The issuer verifies you.',
    body: 'A trusted provider checks your identity once and sends a private credential straight to your wallet.',
  },
  {
    title: 'Your credential stays in your wallet.',
    body: 'It never leaves your control. A proof is the only way it is ever used.',
  },
  {
    title: 'A verifier gets a simple yes.',
    body: 'One answer — "KYC passed and not expired." No documents, no report, no personal data.',
  },
];

const EXTERNAL_LINK =
  'rounded-lg border border-border bg-ink px-3 py-2 text-sm font-medium text-fg transition-colors hover:border-fg-muted/40';

export default function LandingPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [wallets, setWallets] = useState<MidnightWallet[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingName, setPendingName] = useState('');
  const networkId = networkIdForApp();

  function startConnect() {
    const found = listWallets();
    if (found.length === 0) {
      setPhase('no-wallet');
      return;
    }
    setWallets(found);
    setPhase('picking');
  }

  async function handleConnect(w: MidnightWallet, idx: number) {
    const name = w.name || `Wallet ${idx + 1}`;
    setPendingName(name);
    setPhase('connecting');
    setErrorMsg('');
    try {
      const api = await connectWallet(w, networkId);
      const { address, networkId: walletNet } = await readConnection(api);
      const mismatched = walletNet != null && walletNet !== networkId;
      if (mismatched) {
        setPhase('error');
        setErrorMsg(
          `Your wallet is on ${walletNet}, but this app is running on ${network} (${networkId}). Switch networks in your wallet, then try again.`,
        );
        return;
      }
      setConnectedApi(api);
      setWallet({
        name: w.name || 'Midnight wallet',
        address,
        addressShort: `${address.slice(0, 8)}…${address.slice(-6)}`,
        networkId: walletNet ?? networkId,
        networkOk: !mismatched,
      });
    } catch (e) {
      setPhase('error');
      setErrorMsg(
        e instanceof Error ? e.message : 'Connection was declined or could not be established.',
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
      <header className="mb-12">
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-fg sm:text-[2rem]">
          KYCPass
        </h1>
        <p className="mt-2 text-base text-fg-muted sm:text-lg">
          Prove your KYC is valid — without sharing your documents again.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="mb-5 text-sm font-medium text-fg-muted">How it works</h2>
        <ol className="space-y-5">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-fg">{s.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        {/* CTA area */}
        {phase === 'picking' && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-fg">Select a wallet</p>
            {wallets.map((w, i) => (
              <button
                key={i}
                onClick={() => handleConnect(w, i)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:border-accent/40"
              >
                {w.icon ? (
                  <img
                    src={w.icon}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                {w.name || `Wallet ${i + 1}`}
              </button>
            ))}
            <button
              onClick={() => setDemoMode()}
              className="text-sm text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
            >
              Continue in demo mode — no wallet
            </button>
          </div>
        )}

        {phase === 'connecting' && (
          <div className="rounded-lg border border-border bg-surface px-5 py-4 text-sm leading-relaxed text-fg-muted">
            Waiting for approval — check your wallet. The{' '}
            <span className="text-fg font-medium">{pendingName}</span> popup is
            asking you to confirm the connection. This can take a few seconds.
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-danger/30 bg-surface px-5 py-4 text-sm leading-relaxed">
            <span className="font-medium text-danger">Connection failed</span>
            <span className="text-fg-muted"> — {errorMsg}</span>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                onClick={startConnect}
                className="rounded-lg border border-border bg-surface-raised px-4 py-2 text-sm font-medium text-fg transition-colors hover:border-accent/30"
              >
                Try again
              </button>
              <button
                onClick={() => setDemoMode()}
                className="text-sm text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
              >
                Continue in demo mode instead
              </button>
            </div>
          </div>
        )}

        {phase === 'no-wallet' && (
          <div className="rounded-lg border border-border bg-surface px-5 py-4">
            <p className="text-sm font-medium text-fg">No compatible wallet found</p>
            <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
              KYCPass connects through the Midnight DApp Connector. Install one of
              these wallets, enable it in your browser, then come back.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href="https://chromewebstore.google.com/detail/lace/gafhhkghbfjjkeiendhlofajokpaflmk"
                target="_blank"
                rel="noopener noreferrer"
                className={EXTERNAL_LINK}
              >
                Lace — Chrome Web Store
              </a>
              <a
                href="https://docs.midnight.network/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className={EXTERNAL_LINK}
              >
                Midnight docs — install a wallet
              </a>
            </div>
            <button
              onClick={() => setDemoMode()}
              className="mt-4 text-sm text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
            >
              Continue in demo mode — no wallet
            </button>
          </div>
        )}

        {phase === 'idle' && (
          <>
            <button
              onClick={startConnect}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent-hover"
            >
              Connect Wallet to continue
            </button>
            <button
              onClick={() => setDemoMode()}
              className="block text-sm text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
            >
              Continue in demo mode — no wallet
            </button>
            <p className="text-xs text-fg-muted/60">
              Uses the Midnight DApp Connector — compatible with Lace and Midnight
              Passport.
            </p>
          </>
        )}
      </section>
    </div>
  );
}