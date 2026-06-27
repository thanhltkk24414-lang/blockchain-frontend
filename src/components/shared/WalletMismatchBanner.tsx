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
          <h3>Escrow not funded yet</h3>
          <p className="muted">
            On-chain freelancer is <code className="mono">0x000…000</code> — this is{' '}
            <strong>normal</strong> while the job is OPEN. The client assigns the freelancer when
            calling <code>depositEscrow</code>.
          </p>
          <p className="muted">
            After the client funds escrow, switch MetaMask to the wallet used when submitting your
            proposal to call <code>startWork</code> / <code>submitWork</code>.
          </p>
          {onchainStatusLabel && (
            <p className="muted phase-note">
              On-chain status: <strong>{onchainStatusLabel}</strong>
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
          <h3>MetaMask wallet does not match on-chain freelancer</h3>
          <p className="error">
            On-chain freelancer: <code className="mono">{onchainFreelancerCs}</code>
          </p>
          <p className="error">
            Your MetaMask wallet: <code className="mono">{walletCs}</code>
          </p>
          <p className="muted">
            Only the on-chain freelancer wallet can call <code>startWork</code> /{' '}
            <code>submitWork</code>. Switch MetaMask to the wallet that submitted the accepted bid.
          </p>
          {onchainStatusLabel && (
            <p className="muted phase-note">
              On-chain status: <strong>{onchainStatusLabel}</strong>
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
        <h3>MetaMask wallet does not match on-chain client (escrow)</h3>
        <p className="error">
          On-chain client: <code className="mono">{expectedClient}</code>
        </p>
        <p className="error">
          Your MetaMask wallet: <code className="mono">{walletCs}</code>
        </p>
        <p className="muted">
          Only the on-chain client can call <code>depositEscrow</code>. This must be the same
          MetaMask wallet that signed <code>createJob</code> and signed in with SIWE — switch
          MetaMask to that wallet before funding escrow.
        </p>
        <p className="muted phase-note">
          <strong>Mint MockUSDC</strong> to the on-chain client wallet (permissionless on Sepolia)
          before approve &amp; deposit.
        </p>
        {onchainStatusLabel && (
          <p className="muted phase-note">
            On-chain status: <strong>{onchainStatusLabel}</strong>
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
