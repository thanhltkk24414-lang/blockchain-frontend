import { useState } from 'react';
import type { Bid } from '@/lib/api';
import { useAcceptBid } from '@/hooks/useAcceptBid';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { isAddress } from 'viem';

interface AcceptBidButtonProps {
  bid: Bid;
  onchainJobId?: number;
  jobStatus: string;
  hasAcceptedBid?: boolean;
  onAccepted?: () => void;
}

export function AcceptBidButton({
  bid,
  onchainJobId,
  jobStatus,
  hasAcceptedBid = false,
  onAccepted,
}: AcceptBidButtonProps) {
  const { accept, txStatus, txHash, txLabel, txError, resetTx } = useAcceptBid();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (bid.status !== 'pending') {
    return <p className="muted phase-note">Proposal {bid.status}.</p>;
  }

  if (hasAcceptedBid) {
    return <p className="muted phase-note">Another proposal was already accepted for this job.</p>;
  }

  if (jobStatus !== 'OPEN') {
    return null;
  }

  const freelancer = bid.freelancerAddress as `0x${string}`;
  if (!isAddress(freelancer)) {
    return <p className="error">Invalid freelancer wallet on this proposal.</p>;
  }

  if (!isValidOnchainJobId(onchainJobId)) {
    return (
      <p className="muted phase-note">
        Cannot assign on-chain yet — this job has no valid JobRegistry ID. Recreate the job from{' '}
        <a href="/client">Client dashboard</a> so it registers on Sepolia, then freelancers can
        rebid.
      </p>
    );
  }

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      await accept({
        bidId: bid._id,
        onchainJobId: onchainJobId!,
        freelancerAddress: freelancer,
      });
      onAccepted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept bid');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="btn primary"
        type="button"
        onClick={handleAccept}
        disabled={loading || txStatus === 'pending'}
      >
        {loading || txStatus === 'pending' ? 'Accepting…' : 'Accept bid'}
      </button>
      <p className="muted phase-note">
        Accepted in the database — assign freelancer and fund escrow on-chain in the Fund escrow step
        (MetaMask, on-chain client wallet).
      </p>
      {error && <p className="error">{error}</p>}
      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </>
  );
}
