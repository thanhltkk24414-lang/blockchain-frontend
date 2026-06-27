import { useCallback, useState } from 'react';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { withGasLimit, type GasEstimateInput } from '@/lib/utils/contractGas';
import { formatGasWithUsd } from '@/hooks/useEthUsdPrice';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export function useContractTx() {
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();
  const [gasEstimate, setGasEstimate] = useState<string>();

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
    setGasEstimate(undefined);
  }, []);

  const runTx = useCallback(
    async (
      label: string,
      send: () => Promise<`0x${string}`>,
      opts?: { gasParams?: GasEstimateInput; ethUsd?: number | null },
    ) => {
      resetTx();
      setTxLabel(label);

      if (opts?.gasParams) {
        try {
          const { gas } = await withGasLimit(opts.gasParams);
          setGasEstimate(formatGasWithUsd(gas, opts.ethUsd ?? null));
        } catch {
          setGasEstimate(undefined);
        }
      }

      setTxStatus('pending');
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

  return { txStatus, txHash, txLabel, txError, gasEstimate, resetTx, runTx };
}
