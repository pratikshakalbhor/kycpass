import 'dotenv/config';

// ============================================================================
// Network boundaries for KYCPass.
// ----------------------------------------------------------------------------
// The contract is written for Midnight; this module resolves where the app is
// pointed (a local devnet via `docker compose`, or the public Preview network)
// and health-checks the services it depends on. Nothing in here talks to the
// blockchain directly — deployment/submission lives in deploy.ts and the CLI,
// which refuse to act (rather than fabricate success) when the configured
// network is unreachable or the issuer wallet is unfunded.
// ============================================================================

export type NetworkTarget = 'local' | 'preview';

export interface NetworkConfig {
  /** docker-compose devnet (local) or the public Preview network (preview). */
  target: NetworkTarget;
  /** http(s) URL of the Midnight node's RPC endpoint. */
  nodeUrl: string;
  /** http(s) URL of the Midnight indexer. */
  indexerUrl: string;
  /** base URL of the ZK proof server (used only when proving off-chain). */
  proofServerUrl: string;
}

function envVar(name: string, def: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : def;
}

const REVIEW_PREVIEW_NODE = 'https://rpc.preview.midnight.network';
const REVIEW_PREVIEW_INDEXER = 'https://indexer.preview.midnight.network';
const REVIEW_PREVIEW_ZKP = 'https://proof-server.preview.midnight.network';

const LOCAL_NODE = 'http://localhost:9944';
const LOCAL_INDEXER = 'http://localhost:8088';
const LOCAL_ZKP = 'http://localhost:6300';

/** Endpoints the CLI switches to when the user selects --network preview. */
export const REVIEW_PREVIEW = {
  nodeUrl: REVIEW_PREVIEW_NODE,
  indexerUrl: REVIEW_PREVIEW_INDEXER,
  proofServerUrl: REVIEW_PREVIEW_ZKP,
} as const;

const LOCAL = {
  nodeUrl: LOCAL_NODE,
  indexerUrl: LOCAL_INDEXER,
  proofServerUrl: LOCAL_ZKP,
} as const;

export function loadNetworkConfig(): NetworkConfig {
  const target = (process.env.NETWORK ?? 'local').toLowerCase() === 'preview' ? 'preview' : 'local';
  return {
    target,
    nodeUrl: envVar(
      'MIDNIGHT_NODE_URL',
      target === 'preview' ? REVIEW_PREVIEW.nodeUrl : LOCAL.nodeUrl,
    ),
    indexerUrl: envVar(
      'MIDNIGHT_INDEXER_URL',
      target === 'preview' ? REVIEW_PREVIEW.indexerUrl : LOCAL.indexerUrl,
    ),
    proofServerUrl: envVar(
      'MIDNIGHT_PROOF_SERVER_URL',
      target === 'preview' ? REVIEW_PREVIEW.proofServerUrl : LOCAL.proofServerUrl,
    ),
  };
}

async function probe(url: string, append: string): Promise<boolean> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 3000);
    const res = await fetch(`${url}${append}`, { signal: ac.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkNodeHealth(cfg: NetworkConfig): Promise<boolean> {
  return probe(cfg.nodeUrl, '/health');
}

export async function checkIndexerHealth(cfg: NetworkConfig): Promise<boolean> {
  // Indexer health surfaces vary across Midnight releases; try the common ones
  // so a healthy but differently-instrumented indexer isn't reported down:
  // - /health (older standalone images)
  // - /graphql  (pre-v4 indexer base path)
  // - /api/v4/graphql (indexer-standalone 4.x, used by the local devnet)
  if (await probe(cfg.indexerUrl, '/health')) {
    return true;
  }
  for (const path of ['/graphql', '/api/v4/graphql']) {
    try {
      const res = await fetch(`${cfg.indexerUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: '{ chainTip { height } }' }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.status === 200) {
        return true;
      }
    } catch {
      /* try the next probe */
    }
  }
  return false;
}

/** Human-readable readiness report used by the CLI. */
export async function readiness(cfg: NetworkConfig): Promise<{ ok: boolean; lines: string[] }> {
  const lines: string[] = [];
  lines.push(`network target : ${cfg.target}`);
  lines.push(`node           : ${cfg.nodeUrl}`);
  lines.push(`indexer        : ${cfg.indexerUrl}`);
  lines.push(`proof server   : ${cfg.proofServerUrl}`);
  const node = await checkNodeHealth(cfg);
  const indexer = await checkIndexerHealth(cfg);
  lines.push(`node reachable : ${node ? 'yes' : 'NO'}`);
  if (indexer) {
    lines.push('indexer up     : yes');
  } else {
    lines.push(
      'indexer up     : unknown — all probes failed, so no proof-of-life verified',
    );
  }
  lines.push(
    node
      ? 'Node is reachable — on-chain deployment is possible.'
      : 'Node unreachable — nothing can be deployed without it.',
  );
  if (cfg.target === 'preview') {
    lines.push(
      node
        ? 'Preview RPC confirmed online — next step is funding the operator wallet.'
        : 'Preview RPC unreachable. Are you online? Any proxy/region block?',
    );
  } else {
    lines.push(
      node
        ? 'Local devnet is up — you can deploy (`npm run cli -- deploy`).'
        : 'Local devnet is not running — start it with `docker compose up -d`.',
    );
  }
  return { ok: node, lines };
}