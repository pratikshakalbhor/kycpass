import { prepareDeployment } from './deploy.js';
import { printDemo, runDemo } from './demo.js';
import { loadNetworkConfig, readiness, REVIEW_PREVIEW } from './network.js';
import { runSetup } from './setup.js';
import { ensureIssuerKeys, hex } from './wallet.js';

const USAGE = `
kycpass — KYCPass CLI

Commands:
  setup        Verify toolchain, compile, generate issuer keypair, bootstrap .env
  status       Health-check the configured network (local devnet or Preview)
  keys         Show the public issuer identity (never prints secrets)
  demo         Run the full off-chain lifecycle: register → issue → prove → verify
  deploy       Prepare and explain on-chain deployment (needs a funded wallet)
  --help       Show this message

Run any command with --network preview to target the public Preview network,
e.g.:  npm run cli -- deploy --network preview
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? 'help';
  const networkFlag =
    args.indexOf('--network') >= 0 ? args[args.indexOf('--network') + 1] : undefined;
  if (networkFlag === 'preview') {
    process.env.NETWORK = 'preview';
    // .env sets MIDNIGHT_*_URL to the LOCAL devnet endpoints; switch them to
    // the Preview endpoints unless the user overrode those vars explicitly.
    const map: Record<string, [string, string]> = {
      MIDNIGHT_NODE_URL: ['http://localhost:9944', REVIEW_PREVIEW.nodeUrl],
      MIDNIGHT_INDEXER_URL: ['http://localhost:8088', REVIEW_PREVIEW.indexerUrl],
      MIDNIGHT_PROOF_SERVER_URL: ['http://localhost:6300', REVIEW_PREVIEW.proofServerUrl],
    };
    for (const [k, [from, to]] of Object.entries(map)) {
      if (process.env[k] === from) {
        process.env[k] = to;
      }
    }
  }

  switch (cmd) {
    case 'setup': {
      const r = runSetup();
      console.log(r.lines.join('\n'));
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    case 'status': {
      const r = await readiness(loadNetworkConfig());
      console.log(r.lines.join('\n'));
      process.exitCode = r.ok ? 0 : 1;
      return;
    }
    case 'keys': {
      const keys = ensureIssuerKeys();
      console.log(`issuer pubkey : ${hex(keys.pubKey)}`);
      console.log('(keep .midnight-state.json private; it holds the matching secret)');
      return;
    }
    case 'demo': {
      printDemo(runDemo());
      return;
    }
    case 'deploy': {
      const info = await prepareDeployment();
      console.log(`target             : ${info.target}`);
      console.log(`issuer pubkey      : ${info.issuerPubKeyHex}`);
      console.log(`status             : ${info.status}`);
      console.log('');
      for (const l of info.nextAction) console.log(l);
      process.exitCode = info.ok ? 0 : 1;
      return;
    }
    case '--help':
    case 'help':
    default:
      console.log(USAGE);
      return;
  }
}

main().catch((e) => {
  console.error(`cluster error: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});