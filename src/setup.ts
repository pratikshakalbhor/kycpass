import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ensureIssuerKeys, hex } from './wallet.js';

// ============================================================================
// One-command bootstrap for KYCPass.
// ----------------------------------------------------------------------------
// `npm run cli -- setup` verifies the toolchain, compiles the contract into
// managed/, generates (or reuses) the issuer keypair, and writes a `.env` from
// the template when none exists. It never prints or transmits a secret — only
// the derived public issuer identity is shown.
// ============================================================================

export interface SetupResult {
  ok: boolean;
  lines: string[];
  issuerPubKeyHex: string | undefined;
}

function run(cmd: string, args: string[]): { code: number; out: string; err: string } {
  const r = child_process.spawnSync(cmd, args, { encoding: 'utf8' });
  return { code: r.status ?? -1, out: r.stdout ?? '', err: r.stderr ?? '' };
}

function contractIsCompiled(): boolean {
  return fs.existsSync(path.resolve(process.cwd(), 'managed/KYCCredential/contract/index.js'));
}

export function runSetup(): SetupResult {
  const lines: string[] = [];
  let ok = true;

  lines.push('== KYCPass setup ==');

  const compact = run('compact', ['--version']);
  if (compact.code === 0) {
    lines.push(`compact CLI    : ${compact.out.trim().split('\n')[0]}`);
  } else {
    ok = false;
    lines.push('compact CLI    : NOT FOUND (install: `npm run setup`, or see README §7/Toolchain)');
  }

  const node = run('node', ['--version']);
  if (node.code === 0) {
    lines.push(`node           : ${node.out.trim()}`);
  } else {
    ok = false;
    lines.push('node           : NOT FOUND');
  }

  if (contractIsCompiled()) {
    lines.push('compiled bits  : present (managed/KYCCredential)');
  } else {
    lines.push('compiled bits  : missing — running `npm run compile` …');
    const c = run('npm', ['run', 'compile']);
    if (c.code === 0) {
      lines.push('compiled bits  : OK');
    } else {
      ok = false;
      lines.push(`compiled bits  : COMPILE FAILED\n${c.err.trim()}`);
    }
  }

  const keys = ensureIssuerKeys();
  lines.push('issuer keypair : ready (public)');
  lines.push(`issuer pubkey  : ${hex(keys.pubKey)}`);

  const envFile = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envFile) && fs.existsSync(path.resolve(process.cwd(), '.env.example'))) {
    fs.writeFileSync(envFile, fs.readFileSync('.env.example', 'utf8'));
    lines.push('.env           : created from .env.example');
  } else if (fs.existsSync(envFile)) {
    lines.push('.env           : already present (kept)');
  } else {
    lines.push('.env           : (no template found — skipped)');
  }

  lines.push('');
  lines.push('Next steps:');
  lines.push('  npm run test        # run the 7-test suite');
  lines.push('  npm run cli -- --help');
  lines.push('  npm run cli -- demo # full issue → prove → verify flow, off-chain');
  if (ok) {
    lines.push('');
    lines.push('On-chain deployment needs a funded wallet on the target network — see README §3.');
  }

  return { ok, lines, issuerPubKeyHex: hex(keys.pubKey) };
}