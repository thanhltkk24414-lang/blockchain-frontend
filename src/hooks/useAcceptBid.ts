import { useCallback, useState } from 'react';
import { acceptBid } from '@/lib/api';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export function useAcceptBid() {
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
  }, []);

  const accept = useCallback(
    async (params: {
      bidId: string;
      onchainJobId: number;
      freelancerAddress: `0x${string}`;
    }) => {
      void params.onchainJobId;
      void params.freelancerAddress;

      resetTx();
      setTxStatus('pending');
      setTxLabel('Accepting bid…');

      try {
        const apiRes = await acceptBid(params.bidId);
        if (!apiRes.success) {
          throw new Error(apiRes.hint || apiRes.error || 'Failed to accept bid on server');
        }

        setTxStatus('success');
        setTxLabel('Bid accepted — fund escrow with on-chain client wallet');
        return apiRes;
      } catch (err) {
        setTxStatus('failed');
        setTxError(err instanceof Error ? err.message : 'Accept bid failed');
        throw err;
      }
    },
    [resetTx],
  );

  return { accept, txStatus, txHash, txLabel, txError, resetTx };
}
