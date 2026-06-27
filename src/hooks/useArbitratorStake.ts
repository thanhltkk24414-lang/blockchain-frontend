import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { toUsdcUnits } from '@/lib/utils/usdc';
import { executeContractWrite, decodeContractError } from '@/lib/utils/contractWrite';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export const MIN_ARBITRATOR_STAKE_USDC = 50;

export function useArbitratorStake() {
  const { address } = useAccount();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
  }, []);

  const stake = useCallback(
    async (amountUsdc = MIN_ARBITRATOR_STAKE_USDC) => {
      if (!address) throw new Error('Connect your wallet first');

      resetTx();
      setBusy(true);
      setTxStatus('pending');

      try {
        const amount = toUsdcUnits(amountUsdc);

        setTxLabel('Approving USDC for PlatformTreasury…');
        const approveHash = await executeContractWrite({
          address: contracts.mockUsdc.address,
          abi: contracts.mockUsdc.abi as Abi,
          functionName: 'approve',
          args: [contracts.platformTreasury.address, amount],
          account: address,
        });
        setTxHash(approveHash);
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });

        setTxLabel(`Staking ${amountUsdc} USDC as arbitrator…`);
        const stakeHash = await executeContractWrite({
          address: contracts.platformTreasury.address,
          abi: contracts.platformTreasury.abi as Abi,
          functionName: 'stakeAsArbitrator',
          args: [amount],
          account: address,
        });
        setTxHash(stakeHash);
        await waitForTransactionReceipt(wagmiConfig, { hash: stakeHash });
        setTxStatus('success');
        return stakeHash;
      } catch (err) {
        setTxStatus('failed');
        setTxError(
          err instanceof Error
            ? err.message
            : decodeContractError(err, contracts.platformTreasury.abi as Abi),
        );
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [address, resetTx],
  );

  const joinPool = useCallback(async () => {
    if (!address) throw new Error('Connect your wallet first');

    resetTx();
    setBusy(true);
    setTxStatus('pending');
    setTxLabel('Joining arbitrator pool…');

    try {
      const hash = await executeContractWrite({
        address: contracts.arbitratorPanel.address,
        abi: contracts.arbitratorPanel.abi as Abi,
        functionName: 'joinPool',
        args: [address],
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
          : decodeContractError(err, contracts.arbitratorPanel.abi as Abi),
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }, [address, resetTx]);

  return { stake, joinPool, busy, txStatus, txHash, txLabel, txError, resetTx };
}
