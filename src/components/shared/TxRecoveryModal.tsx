import { requestMetaMaskPermissions } from '@/lib/utils/walletAccounts';

interface TxRecoveryModalProps {
  open: boolean;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

const STEPS = [
  'Open the MetaMask extension → select the correct Account (client wallet / SIWE).',
  'Verify the Sepolia network (chainId 11155111).',
  'On Fapex: Disconnect MetaMask → Connect again → select the same account.',
  'If it still fails: click "Request MetaMask permissions" below, then try Create job again.',
];

export function TxRecoveryModal({ open, error, onClose, onRetry }: TxRecoveryModalProps) {
  if (!open) return null;

  async function handleRequestPermissions() {
    try {
      await requestMetaMaskPermissions();
      onRetry?.();
    } catch {
      // user dismissed — keep modal open
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-panel tx-modal">
        <div className="tx-icon failed">!</div>
        <h3>MetaMask rejected transaction parameters</h3>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          Usually caused by the MetaMask account not matching the Fapex-connected wallet or SIWE
          session. Try the following in order:
        </p>
        <ol className="muted" style={{ textAlign: 'left', paddingLeft: '1.25rem' }}>
          {STEPS.map((step) => (
            <li key={step} style={{ marginBottom: '0.35rem' }}>
              {step}
            </li>
          ))}
        </ol>
        <div className="form-actions" style={{ marginTop: '1rem' }}>
          <button type="button" className="btn primary" onClick={() => void handleRequestPermissions()}>
            Request MetaMask permissions
          </button>
          {onRetry && (
            <button type="button" className="btn ghost" onClick={onRetry}>
              Retry
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
