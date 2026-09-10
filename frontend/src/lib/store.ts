// ============================================================================
// Demo session store (framework-agnostic).
// ----------------------------------------------------------------------------
// HOLDS NO SECRETS OUTSIDE MEMORY AND NEVER RENDERS ONE:
//   * every credential secret is generated here, held in a module-level Map,
//     and surfaced to the UI only as a short public digest;
//   * nothing is written to localStorage/sessionStorage or window.console;
//   * a "reuse secret" toggle exists ONLY to demonstrate the wrong approach
//     (rendering the same secret twice) — and even it shows only digests.
//
// The reactivity contract is a tiny subscribe/mutate pair — components read
// `getSession()` after subscribing via `subscribe`. No framework APIs are used
// here, so this module is shared by any UI layer.
// ============================================================================

const PK_DOMAIN = new TextEncoder().encode('kyc:issuer:pk:');

function random32(): Uint8Array {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
}

async function sha256Hex(buf: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** A public, stable display handle for a secret — the only thing the UI may see. */
export type SecretHandle = {
  digest: string;
  short: string;
};

export interface IssuedCredential {
  handle: SecretHandle;
  issuedAt: number;
  expiresAt: number;
  active: boolean;
}

export interface VerifierRecord {
  id: string;
  handle: SecretHandle;
  registered: boolean;
}

export interface SessionState {
  connectorInstalled: boolean;
  issuerSecretId: string;
  issuerPublic: string;
  verifiers: VerifierRecord[];
  userSecretId: string;
  userCredential: IssuedCredential | undefined;
  eventLog: string[];
}

let state: SessionState = {
  connectorInstalled: false,
  issuerSecretId: 'issuer',
  issuerPublic: '',
  verifiers: [],
  userSecretId: 'user',
  userCredential: undefined,
  eventLog: [],
};

// --- tiny reactive core -----------------------------------------------------

let version = 0;
const listeners = new Set<() => void>();

export function getSession(): SessionState {
  return state;
}

export function getSnapshot(): number {
  return version;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function mutate(fn: (s: SessionState) => void): void {
  const next = { ...state, verifiers: [...state.verifiers], eventLog: [...state.eventLog] };
  fn(next);
  state = next;
  version += 1;
  for (const l of listeners) l();
}

// --- secrets (memory-only) --------------------------------------------------

const secrets = new Map<string, Uint8Array>();

function registerSecret(id: string, bytes: Uint8Array): Uint8Array {
  secrets.set(id, bytes);
  return bytes;
}

export function getSecret(id: string): Uint8Array {
  const s = secrets.get(id);
  if (!s) throw new Error(`unknown secret '${id}'`);
  return s;
}

export async function makeHandle(id: string): Promise<SecretHandle> {
  const bytes = registerSecret(id, random32());
  const d = await sha256Hex(bytes);
  return { digest: d, short: d.slice(0, 8) };
}

export async function issuerPublicId(secretId: string): Promise<string> {
  const s = getSecret(secretId);
  const buf = new Uint8Array(PK_DOMAIN.length + s.length);
  buf.set(PK_DOMAIN, 0);
  buf.set(s, PK_DOMAIN.length);
  const d = await sha256Hex(buf);
  return d.slice(0, 12);
}

export function logEvent(msg: string): void {
  // UI-only event log. Deliberately shows public digests, never raw secrets.
  mutate((s) => {
    s.eventLog = [...s.eventLog, msg].slice(-20);
  });
}

export { random32 };