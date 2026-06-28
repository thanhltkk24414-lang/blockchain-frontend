import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import { addressesEqual, tryChecksumAddress, truncateAddress } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import {
  effectiveJobStatus,
  isNonZeroAddress,
} from '@/lib/utils/onchainJob';
import type { Job } from '@/lib/api';

interface WalletMismatchBannerProps {
  job: Job;
  /** True when the connected SIWE user owns this job (client view). */
  isJobOwner?: boolean;
  /**
   * When set, only render banners relevant to that role.
   * Omit to show client mismatch for owners and freelancer mismatch when assigned.
   */
  audience?: 'client' | 'freelancer';
}

export function WalletMismatchBanner({
  job,
  isJobOwner = false,
  audience,
}: WalletMismatchBannerProps) {
  const { address, isConnected } = useAccount();
  const { user } = useAuth();
  const { openConnectModal } = useConnectModal();
  const { onchainFreelancer, onchainClient, onchainStatus, onchainStatusLabel, loading } =
    useOnChainJob(job.onchainJobId, job.status);

  if (!isValidOnchainJobId(job.onchainJobId) || !isConnected || !address) {
    return null;
  }

  const walletCs = tryChecksumAddress(address);
  if (!walletCs) return null;

  const displayStatus = effectiveJobStatus(job.status, onchainStatus);
  const isOpenOnChain = displayStatus === 'OPEN';

  const onchainFreelancerCs = isNonZeroAddress(onchainFreelancer)
    ? tryChecksumAddress(onchainFreelancer)
    : isOpenOnChain
      ? null
      : isNonZeroAddress(job.onchainFreelancerAddress)
        ? tryChecksumAddress(job.onchainFreelancerAddress)
        : isNonZeroAddress(job.freelancerAddress)
          ? tryChecksumAddress(job.freelancerAddress)
          : null;

  const expectedClient =
    tryChecksumAddress(onchainClient) ?? tryChecksumAddress(job.onchainClientAddress);

  const isFreelancerViewer = user?.role === 'freelancer' && !isJobOwner;
  const showClientBanner = audience === 'client' || (audience == null && isJobOwner);
  const showFreelancerBanner =
    audience === 'freelancer' || (audience == null && isFreelancerViewer);

  const SwitchWalletButton = () =>
    openConnectModal ? (
      <button type="button" className="btn primary btn-compact" onClick={openConnectModal}>
        Switch wallet
      </button>
    ) : null;

  if (showFreelancerBanner) {
    if (isOpenOnChain) {
      return (
        <div className="wallet-strip wallet-strip-info" role="status">
          <p>
            <strong>Escrow not funded yet</strong> — normal while job is OPEN. Client assigns freelancer
            on <code>depositEscrow</code>.
          </p>
        </div>
      );
    }

    if (
      onchainFreelancerCs &&
      (displayStatus === 'IN_PROGRESS' ||
        displayStatus === 'SUBMITTED' ||
        displayStatus === 'ASSIGNED')
    ) {
      if (addressesEqual(onchainFreelancerCs, walletCs)) {
        return null;
      }

      return (
        <div className="wallet-strip wallet-strip-error" role="alert">
          <div className="wallet-strip-text">
            <strong>Wallet mismatch</strong>
            <span className="muted">
              On-chain: <code className="mono">{truncateAddress(onchainFreelancerCs, 8, 6)}</code> · Yours:{' '}
              <code className="mono">{truncateAddress(walletCs, 8, 6)}</code>
            </span>
            {onchainStatusLabel && (
              <span className="muted phase-note">Status: {onchainStatusLabel}</span>
            )}
          </div>
          <SwitchWalletButton />
        </div>
      );
    }

    return null;
  }

  if (showClientBanner && expectedClient && !addressesEqual(expectedClient, walletCs)) {
    return (
      <div className="wallet-strip wallet-strip-error" role="alert">
        <div className="wallet-strip-text">
          <strong>Client wallet mismatch</strong>
          <span className="muted">
            On-chain client: <code className="mono">{truncateAddress(expectedClient, 8, 6)}</code> · Yours:{' '}
            <code className="mono">{truncateAddress(walletCs, 8, 6)}</code>
          </span>
          <span className="muted phase-note">
            Switch to the wallet that created this job before funding escrow.
          </span>
        </div>
        <SwitchWalletButton />
      </div>
    );
  }

  if (loading && !onchainFreelancerCs && !expectedClient) {
    return null;
  }

  return null;
}
