import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import { addressesEqual, tryChecksumAddress } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { isNonZeroAddress, ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';
import type { Job } from '@/lib/api';

interface WalletMismatchBannerProps {
  job: Job;
  /** True when the connected SIWE user owns this job (client view). */
  isJobOwner?: boolean;
}

export function WalletMismatchBanner({ job, isJobOwner = false }: WalletMismatchBannerProps) {
  const { address, isConnected } = useAccount();
  const { user } = useAuth();
  const { onchainFreelancer, onchainClient, onchainStatus, onchainStatusLabel, loading } =
    useOnChainJob(job.onchainJobId, job.status);

  if (!isValidOnchainJobId(job.onchainJobId) || !isConnected || !address) {
    return null;
  }

  const walletCs = tryChecksumAddress(address);
  if (!walletCs) return null;

  const onchainFreelancerCs = isNonZeroAddress(onchainFreelancer)
    ? tryChecksumAddress(onchainFreelancer)
    : isNonZeroAddress(job.onchainFreelancerAddress)
      ? tryChecksumAddress(job.onchainFreelancerAddress)
      : isNonZeroAddress(job.freelancerAddress)
        ? tryChecksumAddress(job.freelancerAddress)
        : null;

  const expectedClient =
    tryChecksumAddress(job.onchainClientAddress) ?? tryChecksumAddress(onchainClient);

  const isFreelancerViewer = user?.role === 'freelancer' && !isJobOwner;

  if (isFreelancerViewer) {
    const isOpen = onchainStatus === ONCHAIN_JOB_STATUS.OPEN || job.status === 'OPEN';

    if (isOpen && !onchainFreelancerCs) {
      return (
        <section className="panel wallet-mismatch-banner info" role="status">
          <h3>Chưa nạp escrow</h3>
          <p className="muted">
            Freelancer on-chain hiện là <code className="mono">0x000…000</code> — điều này{' '}
            <strong>bình thường</strong> khi job còn OPEN. Client sẽ gán freelancer khi gọi{' '}
            <code>depositEscrow</code>.
          </p>
          <p className="muted">
            Sau khi client nạp escrow, hãy chuyển MetaMask sang ví đã dùng khi gửi proposal để
            gọi <code>startWork</code> / <code>submitWork</code>.
          </p>
          {onchainStatusLabel && (
            <p className="muted phase-note">
              Trạng thái on-chain: <strong>{onchainStatusLabel}</strong>
            </p>
          )}
        </section>
      );
    }

    if (
      onchainFreelancerCs &&
      (onchainStatus === ONCHAIN_JOB_STATUS.IN_PROGRESS ||
        onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED ||
        onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED ||
        job.status === 'IN_PROGRESS' ||
        job.status === 'SUBMITTED' ||
        job.status === 'ASSIGNED')
    ) {
      if (addressesEqual(onchainFreelancerCs, walletCs)) {
        return null;
      }

      return (
        <section className="panel wallet-mismatch-banner" role="alert">
          <h3>Ví MetaMask không khớp freelancer on-chain</h3>
          <p className="error">
            Freelancer on-chain: <code className="mono">{onchainFreelancerCs}</code>
          </p>
          <p className="error">
            Ví MetaMask của bạn: <code className="mono">{walletCs}</code>
          </p>
          <p className="muted">
            Chỉ ví freelancer on-chain mới gọi được <code>startWork</code> / <code>submitWork</code>.
            Đổi tài khoản MetaMask sang ví đã gửi proposal (địa chỉ bid đã accept).
          </p>
          {onchainStatusLabel && (
            <p className="muted phase-note">
              Trạng thái on-chain: <strong>{onchainStatusLabel}</strong>
            </p>
          )}
        </section>
      );
    }

    return null;
  }

  if (isJobOwner && expectedClient && !addressesEqual(expectedClient, walletCs)) {
    return (
      <section className="panel wallet-mismatch-banner" role="alert">
        <h3>Ví MetaMask không khớp client on-chain (escrow)</h3>
        <p className="error">
          Client on-chain: <code className="mono">{expectedClient}</code>
        </p>
        <p className="error">
          Ví MetaMask của bạn: <code className="mono">{walletCs}</code>
        </p>
        <p className="muted">
          Chỉ client on-chain mới gọi được <code>depositEscrow</code>. Thường là ví backend
          (INDEXER) đã tạo job — không phải ví SIWE đăng nhập. Chuyển MetaMask sang ví client
          on-chain trước khi nạp escrow.
        </p>
        <p className="muted phase-note">
          <strong>Mint MockUSDC</strong> vẫn dùng được với ví hiện tại (permissionless), nhưng
          USDC mint vào ví đang kết nối — để deposit, mint sau khi đã chuyển sang ví client
          on-chain ở trên.
        </p>
        {onchainStatusLabel && (
          <p className="muted phase-note">
            Trạng thái on-chain: <strong>{onchainStatusLabel}</strong>
          </p>
        )}
      </section>
    );
  }

  if (loading && !onchainFreelancerCs && !expectedClient) {
    return null;
  }

  return null;
}
