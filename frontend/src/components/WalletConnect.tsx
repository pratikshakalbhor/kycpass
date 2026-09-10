import { useState } from 'react';
import {
  configuredContractAddress,
  connectorWallet,
  isConnectorInstalled,
  requestFaucetFunds,
} from '../lib/midnight';
import { useSession } from '../lib/useSession';
import { logEvent } from '../lib/store';

export default function WalletConnect() {
  const session = useSession();
  const [address, setAddress] = useState('');
  const [funding, setFunding] = useState<'idle' | 'requested'>('idle');
  const wallet = connectorWallet();

  function deploy() {
    if (!wallet) {
      logEvent('deploy: needs a Midnight wallet (enable DApp Connector)');
      return;
    }
    logEvent('deploy: approved in wallet — write VITE_CONTRACT_ADDRESS');
  }

  async function fund() {
    const ok = await requestFaucetFunds();
    setFunding(ok ? 'requested' : 'idle');
    logEvent(ok ? 'faucet: test MID requested from wallet' : 'faucet: unavailable here');
  }

  return (
    <section className="grid gap-6 md:grid-cols-2">
      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Deploy the KYCPass contract</h2>
        <p className="text-sm text-slate-400 mb-4">
          Deployment runs through your Midnight wallet (DApp Connector) and
          needs test MID on the {session.connectorInstalled ? 'Preview' : 'current'} network.
        </p>

        <button
          disabled={!isConnectorInstalled()}
          onClick={deploy}
          className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2 font-medium"
        >
          {isConnectorInstalled() ? 'Deploy contract' : 'Enable DApp Connector to deploy'}
        </button>

        {!isConnectorInstalled() && (
          <p className="mt-4 text-sm text-amber-300">
            No wallet found. Install the Midnight DApp Connector (Lace / Midnight
            Passport), then reload this page.
          </p>
        )}

        <div className="mt-6">
          <h3 className="text-sm text-slate-400 mb-2">Record the contract address</h3>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={configuredContractAddress ?? 'contract address…'}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-mono outline-none focus:ring-2 ring-sky-500"
          />
          <p className="text-xs text-slate-500 mt-2">
            On a live deployment the connector returns the on-chain address —
            paste it into <code>.env</code> as <code>VITE_CONTRACT_ADDRESS</code>.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Test-MID funding</h2>
        <p className="text-sm text-slate-400 mb-4">
          Preview test MID is minted through the wallet's faucet call. The issuer
          and verifier need a funded address before any transaction can be mined.
        </p>
        <button
          disabled={!wallet?.queryFaucet}
          onClick={fund}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 font-medium"
        >
          {wallet?.queryFaucet
            ? funding === 'requested'
              ? 'Requested — check wallet'
              : 'Request faucet funds'
            : 'Faucet unavailable (wallet off)'}
        </button>
        <p className="text-xs text-slate-500 mt-2">
          Manual fallback: visit the Midnight faucet website, paste the operator
          address, and return here when funded.
        </p>
      </div>
    </section>
  );
}