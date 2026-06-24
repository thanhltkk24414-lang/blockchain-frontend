import { useCallback, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
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
      setTxLabel('Accepting bid & assigning on-chain…');

      try {
        const apiRes = await acceptBid(params.bidId);
        if (!apiRes.success) {
          throw new Error(apiRes.hint || 'Failed to accept bid on server');
        }

        if (apiRes.assignTxHash) {
          setTxHash(apiRes.assignTxHash);
          await waitForTransactionReceipt(wagmiConfig, {
            hash: apiRes.assignTxHash as `0x${string}`,
          });
        }

        setTxStatus('success');
        setTxLabel('Freelancer assigned on JobRegistry');
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
