import { loadNetworkConfig, readiness } from './network.js';
import { ensureIssuerKeys, hex } from './wallet.js';

// ============================================================================
// Deployment boundary.
// ----------------------------------------------------------------------------
// This module is deliberately honest about what a headless repo can and cannot
// do. Building the constructor state and computing the issuer identity are
// fully deterministic and implemented here (off-chain). Actually *submitting*
// the deploy transaction on a Midnight network requires the operator's wallet
// (signing) plus a funded address — there is no way to fabricate that, so this
// module reports the exact state and the exact next action instead.
//
// In the browser, `npm run frontend:dev` deploys the contract through the
// Midnight DApp Connector exactly once and records the returned address in
// .env (VITE_CONTRACT_ADDRESS).
// ============================================================================

export interface DeploymentInfo {
  ok: boolean;
  issuerPubKeyHex: string;
  target: string;
  contractAddress: string | undefined;
  status: 'ready-offline' | 'network-unreachable' | 'needs-funding' | 'deployed';
  nextAction: string[];
}

export async function prepareDeployment(): Promise<DeploymentInfo> {
  const cfg = loadNetworkConfig();
  const keys = ensureIssuerKeys();
  const r = await readiness(cfg);

  const base: DeploymentInfo = {
    ok: r.ok,
    issuerPubKeyHex: hex(keys.pubKey),
    target: cfg.target,
    contractAddress: undefined,
    status: r.ok ? 'needs-funding' : 'network-unreachable',
    nextAction: [],
  };

  if (!r.ok) {
    base.nextAction = [
      ...r.lines,
      '',
      cfg.target === 'local'
        ? 'Start the devnet: `docker compose up -d`, then rerun `npm run cli -- deploy`.'
        : 'Check your network connection and rerun `npm run cli -- deploy`.',
    ];
    return base;
  }

  base.nextAction = [
    ...r.lines,
    '',
    'Node is reachable. Deployment itself needs the signing wallet:',
    '1. Have the operator\'s WalletConnect wallet (from the frontend) funded with test MID.',
    `   Public issuer identity is: ${hex(keys.pubKey)}`,
    '2. From the frontend, click "Deploy contract" and accept in the wallet.',
    '3. Copy the returned contract address into .env as VITE_CONTRACT_ADDRESS.',
  ];
  return base;
}