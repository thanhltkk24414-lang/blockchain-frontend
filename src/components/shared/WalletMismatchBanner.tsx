import { useAccount } from 'wagmi';
import { addressesEqual, tryChecksumAddress } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import type { Job } from '@/lib/api';

interface WalletMismatchBannerProps {
  job: Job;
}

export function WalletMismatchBanner({ job }: WalletMismatchBannerProps) {
  const { address, isConnected } = useAccount();
  const { onchainFreelancer, onchainClient, onchainStatusLabel, loading } = useOnChainJob(
    job.onchainJobId,
    job.status,
  );

  if (!isValidOnchainJobId(job.onchainJobId) || !isConnected || !address) {
    return null;
  }

  const expectedFreelancer =
    tryChecksumAddress(job.onchainFreelancerAddress) ??
    tryChecksumAddress(onchainFreelancer) ??
    tryChecksumAddress(job.freelancerAddress);

  const walletCs = tryChecksumAddress(address);
  const freelancerMismatch =
    expectedFreelancer && walletCs && !addressesEqual(expectedFreelancer, walletCs);

  const expectedClient =
    tryChecksumAddress(job.onchainClientAddress) ?? tryChecksumAddress(onchainClient);
  const clientMismatch =
    expectedClient && walletCs && !addressesEqual(expectedClient, walletCs);

  if (!freelancerMismatch && !clientMismatch) {
    return null;
  }

  if (loading && !expectedFreelancer && !expectedClient) {
    return null;
  }

  return (
    <section className="panel wallet-mismatch-banner" role="alert">
      <h3>Ví MetaMask không khớp on-chain</h3>
      {freelancerMismatch && expectedFreelancer && walletCs && (
        <>
          <p className="error">
            Freelancer on-chain: <code className="mono">{expectedFreelancer}</code>
          </p>
          <p className="error">
            Ví MetaMask của bạn: <code className="mono">{walletCs}</code>
          </p>
          <p className="muted">
            Hai địa chỉ khác nhau (không chỉ khác chữ hoa). Chỉ ví freelancer on-chain mới gọi được{' '}
            <code>startWork</code> / <code>submitWork</code>. Đổi tài khoản MetaMask hoặc tạo job
            mới nếu client đã nạp escrow với địa chỉ sai.
          </p>
        </>
      )}
      {clientMismatch && expectedClient && walletCs && (
        <>
          <p className="error">
            Client on-chain: <code className="mono">{expectedClient}</code>
          </p>
          <p className="error">
            Ví MetaMask của bạn: <code className="mono">{walletCs}</code>
          </p>
          <p className="muted">
            Chỉ client on-chain mới gọi được <code>depositEscrow</code>. Thường là ví backend (
            INDEXER) đã tạo job — không phải ví SIWE đăng nhập.
          </p>
        </>
      )}
      {onchainStatusLabel && (
        <p className="muted phase-note">
          Trạng thái on-chain hiện tại: <strong>{onchainStatusLabel}</strong>
        </p>
      )}
    </section>
  );
}
