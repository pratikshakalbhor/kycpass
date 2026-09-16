import { useSession } from '../lib/useSession';
import { disconnectWallet } from '../lib/store';

export default function WalletIndicator() {
  const session = useSession();
  const w = session.wallet;

  if (w === null) {
    return null;
  }

  if (w === 'demo') {
    return (
      <div className="flex items-center gap-3 text-xs">
        <span className="rounded-md border border-border bg-surface px-2.5 py-1 font-medium text-fg-muted">
          Demo Mode — no wallet connected
        </span>
        <button
          onClick={() => disconnectWallet()}
          className="text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
        >
          Reconnect
        </button>
      </div>
    );
  }

  const netOk = w.networkOk;

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium text-fg">{w.name}</span>
        <span
          title={w.address}
          className="rounded-md bg-surface border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted"
        >
          {w.addressShort}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
            netOk
              ? 'border-border bg-surface text-fg-muted'
              : 'border-danger/30 bg-surface text-danger'
          }`}
          title={netOk ? undefined : `Expected ${w.networkId}`}
        >
          {w.networkId}
          {!netOk && ' — mismatch'}
        </span>
      </div>
      <button
        onClick={() => disconnectWallet()}
        className="text-fg-muted underline decoration-fg-muted/30 underline-offset-2 transition-colors hover:text-fg"
      >
        Disconnect
      </button>
    </div>
  );
}