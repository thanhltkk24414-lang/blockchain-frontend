import { useState } from 'react';
import { useAccount } from 'wagmi';
import type { Job } from '@/lib/api';
import { useEscrowDeposit } from '@/hooks/useEscrowDeposit';
import { useUsdcBalance } from '@/hooks/contracts/useContracts';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { isAddress } from 'viem';

interface EscrowDepositPanelProps {
  job: Job;
}

function resolveClientAddress(job: Job): string | null {
  if (job.clientAddress) return job.clientAddress.toLowerCase();
  if (typeof job.client === 'object' && job.client?.walletAddress) {
    return job.client.walletAddress.toLowerCase();
  }
  if (typeof job.client === 'string') return job.client.toLowerCase();
  return null;
}

function resolveOnchainClientAddress(job: Job): string | null {
  return job.onchainClientAddress?.toLowerCase() ?? null;
}

function resolveFreelancerAddress(job: Job): string | null {
  if (job.freelancerAddress) return job.freelancerAddress;
  if (typeof job.freelancer === 'object' && job.freelancer?.walletAddress) {
    return job.freelancer.walletAddress;
  }
  return null;
}

export function EscrowDepositPanel({ job }: EscrowDepositPanelProps) {
  const { address, isConnected } = useAccount();
  const clientAddr = resolveClientAddress(job);
  const onchainClientAddr = resolveOnchainClientAddress(job);
  const isSiweClient = Boolean(
    address && clientAddr && address.toLowerCase() === clientAddr,
  );
  const isOnchainClient = Boolean(
    address &&
      onchainClientAddr &&
      address.toLowerCase() === onchainClientAddr,
  );
  const walletMismatch = Boolean(
    isConnected && onchainClientAddr && address && !isOnchainClient,
  );
  const existingFreelancer = resolveFreelancerAddress(job);
  const [freelancerInput, setFreelancerInput] = useState(existingFreelancer ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  const { deposit, txStatus, txHash, txLabel, txError, resetTx, totalDepositUsdc } =
    useEscrowDeposit();
  const { data: balance } = useUsdcBalance(address);

  if (!isValidOnchainJobId(job.onchainJobId) || !isSiweClient) {
    return null;
  }

  const contractValue = job.contractValue ?? 0;
  const totalDeposit = job.totalDeposit ?? totalDepositUsdc(contractValue);
  const balanceUsdc =
    balance != null ? Number(balance) / 1_000_000 : null;
  const insufficientUsdc =
    balanceUsdc != null && balanceUsdc < totalDeposit;

  async function handleDeposit() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Kết nối ví MetaMask trên mạng Sepolia.');
      return;
    }
    if (walletMismatch && onchainClientAddr) {
      setLocalError(
        `Ví đang kết nối không phải client on-chain. Hãy chuyển sang ${onchainClientAddr.slice(0, 6)}…${onchainClientAddr.slice(-4)} (ví backend tạo job).`,
      );
      return;
    }
    if (insufficientUsdc) {
      setLocalError(
        `Số dư MockUSDC không đủ (cần ${totalDeposit} USDC). Mint testnet USDC trên Sepolia trước.`,
      );
      return;
    }
    if (!job.onchainJobId || !contractValue) {
      setLocalError('Job thiếu on-chain id hoặc giá trị hợp đồng.');
      return;
    }
    const freelancer = freelancerInput.trim();
    if (!isAddress(freelancer)) {
      setLocalError('Nhập địa chỉ ví freelancer hợp lệ (0x…).');
      return;
    }

    setDepositing(true);
    try {
      await deposit({
        onchainJobId: job.onchainJobId,
        freelancerAddress: freelancer as `0x${string}`,
        contractValue,
      });
    } catch {
      // tx state handled in hook
    } finally {
      setDepositing(false);
    }
  }

  return (
    <section className="panel escrow-panel">
      <h3>Fund escrow (USDC)</h3>
      <p className="muted" title="Nạp tiền ký quỹ on-chain">
        <strong>Nạp ký quỹ (Fund escrow):</strong> Client gửi MockUSDC vào hợp đồng{' '}
        <code>EscrowVault</code> để khóa tiền cho freelancer. Tổng nạp = giá job + 3% phí
        nền tảng. Bước này gồm <em>approve</em> USDC rồi <em>depositEscrow</em> — chỉ ví{' '}
        <strong>client on-chain</strong> (người tạo job trên JobRegistry) mới gọi được.
      </p>

      {onchainClientAddr && (
        <p className="muted phase-note">
          Client on-chain:{' '}
          <code>
            {onchainClientAddr.slice(0, 6)}…{onchainClientAddr.slice(-4)}
          </code>
          {walletMismatch && (
            <span className="error">
              {' '}
              — ví MetaMask hiện tại khác ví này; giao dịch sẽ revert.
            </span>
          )}
        </p>
      )}

      <dl className="detail-grid">
        <dt>Contract value</dt>
        <dd>{contractValue} USDC</dd>
        <dt>Total deposit</dt>
        <dd>{totalDeposit} USDC</dd>
        {balanceUsdc != null && (
          <>
            <dt>Your USDC balance</dt>
            <dd className={insufficientUsdc ? 'error' : undefined}>
              {balanceUsdc.toLocaleString()} USDC
              {insufficientUsdc && ' — cần mint MockUSDC trên Sepolia'}
            </dd>
          </>
        )}
      </dl>

      {!existingFreelancer && (
        <div className="field">
          <label htmlFor="freelancer-addr">Freelancer address</label>
          <input
            id="freelancer-addr"
            className="input full"
            value={freelancerInput}
            onChange={(e) => setFreelancerInput(e.target.value)}
            placeholder="0x… (từ proposal đã chấp nhận)"
          />
          <span className="muted phase-note">
            Tự điền từ proposal đã accept khi có trong DB.
          </span>
        </div>
      )}

      {localError && <p className="error">{localError}</p>}

      <button
        className="btn primary"
        type="button"
        onClick={handleDeposit}
        disabled={depositing || txStatus === 'pending' || walletMismatch || insufficientUsdc}
      >
        {depositing || txStatus === 'pending' ? 'Processing…' : 'Approve & deposit escrow'}
      </button>

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </section>
  );
}
