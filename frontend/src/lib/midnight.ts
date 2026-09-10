// ============================================================================
// Midnight DApp Connector bridge.
// ----------------------------------------------------------------------------
// The Midnight DApp Connector injects a `window.midnight` API into the browser
// when the user's wallet extension (e.g. Lace / Midnight Passport) is active.
// This module only *detects* it and offers the exact API surface we rely on;
// the wallet does the signing/proving, so no secret ever reaches this
// application's code.
// ============================================================================

export interface MidnightConnectorWallet {
  /** Ask the wallet to request test MID from the Preview faucet. */
  queryFaucet?: () => Promise<void>;
}

export interface MidnightConnector {
  wallet?: MidnightConnectorWallet;
}

declare global {
  interface Window {
    midnight?: MidnightConnector;
  }
}

export function connectorWallet(): MidnightConnectorWallet | undefined {
  return typeof window !== 'undefined' ? window.midnight?.wallet : undefined;
}

export function isConnectorInstalled(): boolean {
  return connectorWallet() !== undefined;
}

/** Which network the frontend build was pointed at (see root .env / VITE_*). */
export const network =
  (import.meta.env.VITE_NETWORK as string | undefined) ?? 'local';

/** Address of an already-deployed contract, or undefined before deployment. */
export const configuredContractAddress = (import.meta.env
  .VITE_CONTRACT_ADDRESS as string | undefined) ?? undefined;

export async function requestFaucetFunds(): Promise<boolean> {
  const w = connectorWallet();
  if (!w?.queryFaucet) {
    return false;
  }
  await w.queryFaucet();
  return true;
}