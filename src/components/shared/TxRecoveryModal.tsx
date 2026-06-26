import { requestMetaMaskPermissions } from '@/lib/utils/walletAccounts';

interface TxRecoveryModalProps {
  open: boolean;
  error?: string;
  onClose: () => void;
  onRetry?: () => void;
}

const STEPS = [
  'Mở extension MetaMask → chọn đúng Account (ví client / SIWE).',
  'Kiểm tra mạng Sepolia (chainId 11155111).',
  'Trên Fapex: Disconnect MetaMask → Connect lại → chọn cùng account.',
  'Nếu vẫn lỗi: bấm "Yêu cầu quyền MetaMask" bên dưới rồi thử Create job lại.',
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
        <h3>MetaMask từ chối tham số giao dịch</h3>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          Thường do account trong MetaMask không khớp ví Fapex đã kết nối hoặc SIWE. Làm lần lượt:
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
            Yêu cầu quyền MetaMask
          </button>
          {onRetry && (
            <button type="button" className="btn ghost" onClick={onRetry}>
              Thử lại
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
