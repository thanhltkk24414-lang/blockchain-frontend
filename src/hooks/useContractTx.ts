import { useCallback, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export function useContractTx() {
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

  const runTx = useCallback(
    async (label: string, send: () => Promise<`0x${string}`>) => {
      resetTx();
      setTxStatus('pending');
      setTxLabel(label);
      try {
        const hash = await send();
        setTxHash(hash);
        await waitForTransactionReceipt(wagmiConfig, { hash });
        setTxStatus('success');
        return hash;
      } catch (err) {
        setTxStatus('failed');
        setTxError(err instanceof Error ? err.message : 'Transaction failed');
        throw err;
      }
    },
    [resetTx],
  );

  return { txStatus, txHash, txLabel, txError, resetTx, runTx };
}
