import { useState } from 'react';
import { configuredContractAddress, requestFaucetFunds } from '../lib/midnight';
import { useSession } from '../lib/useSession';
import { logEvent } from '../lib/store';

export default function WalletConnect() {
  const session = useSession();
  const [address, setAddress] = useState('');
  const [funding, setFunding] = useState<'idle' | 'requested'>('idle');
  const live = session.wallet; // 'demo' | ConnectedWallet
  const walletConnected = live !== 'demo';

  function deploy() {
    if (!walletConnected) {
      logEvent('deploy: demo mode — connect a real wallet to deploy');
      return;
    }
    logEvent('deploy: approved in wallet — write VITE_CONTRACT_ADDRESS');
  }

  async function fund() {
    if (!walletConnected) {
      setFunding('idle');
      logEvent('faucet: unavailable in demo mode');
      return;
    }
    const ok = await requestFaucetFunds();
    setFunding(ok ? 'requested' : 'idle');
    logEvent(ok ? 'faucet: test MID requested from wallet' : 'faucet: unavailable here');
  }

  return (
    <section className="grid gap-5 md:grid-cols-2">
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Deploy the contract</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          {walletConnected
            ? 'Deploy KYCPass to the local devnet through your wallet.'
            : 'Demo mode: nothing is deployed. Connect a real Midnight wallet to actually deploy the contract.'}
        </p>

        <button
          disabled={!walletConnected}
          onClick={deploy}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-accent/30"
        >
          {walletConnected ? 'Deploy contract' : 'Connect a wallet to deploy'}
        </button>

        {!walletConnected && (
          <p className="mt-4 rounded-lg border border-border bg-ink px-4 py-3 text-sm leading-relaxed text-fg-muted">
            Demo mode runs the whole flow with simulated keys and proofs — perfect
            for exploring the UI. Deploying is only possible with a real wallet.
          </p>
        )}

        <div className="mt-5 border-t border-border pt-4">
          <label className="mb-1.5 block text-xs font-medium text-fg-muted">
            Contract address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={configuredContractAddress ?? 'paste address after deployment…'}
            className="w-full rounded-lg border border-border bg-ink px-3 py-2 font-mono text-xs text-fg placeholder:text-fg-muted/50 transition-colors focus:border-accent"
          />
          <p className="mt-2 text-xs leading-relaxed text-fg-muted/70">
            On a live deployment the connector returns the on-chain address —
            paste it into <code className="font-mono text-fg-muted">.env</code> as{' '}
            <code className="font-mono text-fg-muted">VITE_CONTRACT_ADDRESS</code>.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-base font-semibold text-fg">Fund with test MID</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          The issuer and verifier each need a funded address before any transaction
          can be processed. In demo mode this step is skipped.
        </p>

        <button
          disabled={!walletConnected}
          onClick={fund}
          className="mt-5 w-full rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-fg transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {walletConnected
            ? funding === 'requested'
              ? 'Requested — check your wallet'
              : 'Request faucet funds'
            : 'Not available in demo mode'}
        </button>

        <p className="mt-4 text-xs leading-relaxed text-fg-muted/70">
          On the public Preview network, you can visit the Midnight faucet
          website directly and paste your operator address.
        </p>
      </div>
    </section>
  );
}