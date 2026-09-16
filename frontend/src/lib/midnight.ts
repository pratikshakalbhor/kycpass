// ============================================================================
// Midnight DApp Connector bridge.
// ----------------------------------------------------------------------------
// Compatible wallets (Lace, Midnight Passport, or any wallet implementing the
// DApp Connector API) inject one `InitialAPI` per wallet under the global
// `window.midnight` object, keyed by a fresh UUID rather than a fixed name —
// so this module always enumerates `Object.values(window.midnight)` and never
// assumes a specific wallet key.
//
// Connection state lives in the in-memory session store (see store.ts). No
// key, secret, or ConnectedAPI object is ever persisted to storage or console.
// ============================================================================

/** Initial API a wallet injects into `window.midnight`. */
export interface MidnightWallet {
  /** Wallet name, expected to be displayed to the user. */
  name?: string;
  /** Wallet icon: hosted URL or base64 data URL. */
  icon?: string;
  /** Version of the DApp Connector API this wallet implements (e.g. "3.1.5"). */
  apiVersion?: string;
  /** Request a connection; resolves (slowly — popup) or rejects (declined). */
  connect?: (networkId: string) => Promise<ConnectedAPI>;
}

/** The connected wallet surface we rely on. */
export interface ConnectedAPI {
  getUnshieldedAddress: () => Promise<{ unshieldedAddress: string }>;
  getConnectionStatus?: () => Promise<{ status: string; networkId?: string }>;
  getConfiguration?: () => Promise<{ networkId?: string; [key: string]: unknown }>;
  disconnect?: () => Promise<void> | void;
  /** Optional legacy faucet capability on the connected wallet. */
  queryFaucet?: () => Promise<void>;
}

declare global {
  interface Window {
    midnight?: Record<string, MidnightWallet>;
  }
}

/** Which network the frontend build was pointed at (see root .env / VITE_*). */
export const network =
  (import.meta.env.VITE_NETWORK as string | undefined) ?? 'local';

/** Address of an already-deployed contract, or undefined before deployment. */
export const configuredContractAddress = (import.meta.env
  .VITE_CONTRACT_ADDRESS as string | undefined) ?? undefined;

/** Midnight network id this app targets — mirrors `network` to the DApp
 *  Connector's vocabulary (`undeployed` = local devnet, `preview` = Preview). */
export function networkIdForApp(): string {
  return network === 'preview' ? 'preview' : 'undeployed';
}

/** Enumerate installed Midnight wallets. Never hardcodes a wallet name. */
export function listWallets(): MidnightWallet[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return window.midnight ? Object.values(window.midnight) : [];
}

export function isConnectorInstalled(): boolean {
  return listWallets().length > 0;
}

/** Request a connection through the chosen wallet for the given network id.
 *  Resolves when the user approves, rejects when they decline (or the wallet
 *  is on an incompatible network). */
export async function connectWallet(
  wallet: MidnightWallet,
  networkId: string,
): Promise<ConnectedAPI> {
  const connect = wallet.connect;
  if (typeof connect !== 'function') {
    throw new Error('This wallet does not expose a connector API.');
  }
  return connect(networkId);
}

/** Read back the connected wallet's unshielded address and the network it
 *  reports, so the app can validate it matches its own target. */
export async function readConnection(api: ConnectedAPI): Promise<{
  address: string;
  networkId: string | undefined;
}> {
  const [{ unshieldedAddress }, status, config] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getConnectionStatus?.().catch(() => undefined) ?? Promise.resolve(undefined),
    api.getConfiguration?.().catch(() => undefined) ?? Promise.resolve(undefined),
  ]);
  const walletNetwork = status?.networkId ?? config?.networkId;
  return { address: unshieldedAddress, networkId: walletNetwork };
}

/** Legacy best-effort bridge: some wallets expose a `wallet` sub-object on the
 *  injected API with `queryFaucet`. Kept for backward compatibility. */
export function connectorWallet(): VoidFunction | undefined {
  const w = listWallets()[0];
  if (!w) {
    return undefined;
  }
  const legacy = (w as unknown as { wallet?: { queryFaucet?: () => Promise<void> } })
    .wallet;
  return legacy?.queryFaucet ? legacy.queryFaucet : undefined;
}

/** Request test MID through whatever faucet capability is present. */
export async function requestFaucetFunds(): Promise<boolean> {
  const faucet = connectorWallet();
  if (faucet) {
    await faucet();
    return true;
  }
  return false;
}