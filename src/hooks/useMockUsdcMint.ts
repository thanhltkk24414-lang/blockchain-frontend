import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { toUsdcUnits } from '@/lib/utils/usdc';
import { executeContractWrite, decodeContractError } from '@/lib/utils/contractWrite';
import type { TxStatus } from '@/components/shared/TxStatusModal';

/** Default demo mint — enough for several escrow deposits. */
export const DEMO_MINT_USDC = 1000;

export function useMockUsdcMint() {
  const { address } = useAccount();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState<string>();
  const [minting, setMinting] = useState(false);

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxError(undefined);
  }, []);

  const mint = useCallback(
    async (amountUsdc = DEMO_MINT_USDC) => {
      if (!address) throw new Error('Connect your wallet first');

      resetTx();
      setMinting(true);
      setTxStatus('pending');

      try {
        const hash = await executeContractWrite({
          address: contracts.mockUsdc.address,
          abi: contracts.mockUsdc.abi as Abi,
          functionName: 'mint',
          args: [address, toUsdcUnits(amountUsdc)],
          account: address,
        });
        setTxHash(hash);
        await waitForTransactionReceipt(wagmiConfig, { hash });
        setTxStatus('success');
        return hash;
      } catch (err) {
        setTxStatus('failed');
        setTxError(
          err instanceof Error
            ? err.message
            : decodeContractError(err, contracts.mockUsdc.abi as Abi),
        );
        throw err;
      } finally {
        setMinting(false);
      }
    },
    [address, resetTx],
  );

  return { mint, minting, txStatus, txHash, txError, resetTx };
}
