import { etherscanTxUrl, shortenHash } from '@/lib/utils/etherscan';

export type TxStatus = 'idle' | 'pending' | 'success' | 'failed';

interface TxStatusModalProps {
  open: boolean;
  status: TxStatus;
  label: string;
  hash?: string;
  error?: string;
  onClose: () => void;
}

export function TxStatusModal({ open, status, label, hash, error, onClose }: TxStatusModalProps) {
  if (!open || status === 'idle') return null;

  const canClose = status !== 'pending';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel tx-modal">
        {status === 'pending' && (
          <>
            <div className="tx-spinner" aria-hidden />
            <h3>Transaction pending</h3>
            <p className="muted">{label}</p>
            <p className="muted phase-note">Confirm in your wallet and wait for the block.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="tx-icon success">✓</div>
            <h3>Transaction confirmed</h3>
            <p className="muted">{label}</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="tx-icon failed">✕</div>
            <h3>Transaction failed</h3>
            <p className="error">{error ?? 'Something went wrong.'}</p>
          </>
        )}

        {hash && status !== 'failed' && (
          <a
            className="etherscan-link"
            href={etherscanTxUrl(hash)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {shortenHash(hash)} ↗
          </a>
        )}

        {canClose && (
          <button className="btn primary" type="button" onClick={onClose}>
            {status === 'success' ? 'Done' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
}
