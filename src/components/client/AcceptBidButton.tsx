import { useState } from 'react';
import type { Bid } from '@/lib/api';
import { useAcceptBid } from '@/hooks/useAcceptBid';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isAddress } from 'viem';

interface AcceptBidButtonProps {
  bid: Bid;
  onchainJobId: number;
  jobStatus: string;
  onAccepted?: () => void;
}

export function AcceptBidButton({ bid, onchainJobId, jobStatus, onAccepted }: AcceptBidButtonProps) {
  const { accept, txStatus, txHash, txLabel, txError, resetTx } = useAcceptBid();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (bid.status !== 'pending' || jobStatus !== 'OPEN') return null;

  const freelancer = bid.freelancerAddress as `0x${string}`;
  if (!isAddress(freelancer)) return null;

  async function handleAccept() {
    setLoading(true);
    setError(null);
    try {
      await accept({
        bidId: bid._id,
        onchainJobId,
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
        {loading || txStatus === 'pending' ? 'Accepting…' : 'Accept & assign on-chain'}
      </button>
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
