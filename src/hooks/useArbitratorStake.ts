import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import type { Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { toUsdcUnits } from '@/lib/utils/usdc';
import { decodeContractError } from '@/lib/utils/contractWrite';
import {
  sendApproveUsdcTx,
  sendJoinPoolTx,
  sendStakeAsArbitratorTx,
} from '@/lib/utils/sendArbitratorOnboardingTx';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export const MIN_ARBITRATOR_STAKE_USDC = 50;

async function waitForSuccess(hash: `0x${string}`): Promise<void> {
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (receipt.status === 'reverted') {
    throw new Error('Transaction reverted on-chain — check Etherscan for details.');
  }
}

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
        const treasury = CONTRACT_ADDRESSES.PlatformTreasury;

        const balance = (await readContract(wagmiConfig, {
          ...contracts.mockUsdc,
          functionName: 'balanceOf',
          args: [address],
        })) as bigint;

        if (balance < amount) {
          throw new Error(
            `Insufficient MockUSDC balance (${Number(balance) / 1e6} USDC). Mint test USDC in Step 1 first.`,
          );
        }

        const allowance = (await readContract(wagmiConfig, {
          ...contracts.mockUsdc,
          functionName: 'allowance',
          args: [address, treasury],
        })) as bigint;

        if (allowance < amount) {
          setTxLabel('Approving USDC for PlatformTreasury…');
          const approveHash = await sendApproveUsdcTx(treasury, amount);
          setTxHash(approveHash);
          await waitForSuccess(approveHash);
        }

        setTxLabel(`Staking ${amountUsdc} USDC as arbitrator…`);
        const stakeHash = await sendStakeAsArbitratorTx(amount);
        setTxHash(stakeHash);
        await waitForSuccess(stakeHash);
        setTxStatus('success');
        return stakeHash;
      } catch (err) {
        setTxStatus('failed');
        setTxError(
          err instanceof Error
            ? err.message
            : decodeContractError(err, contracts.platformTreasury.abi as Abi, 'stakeAsArbitrator'),
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
      const hash = await sendJoinPoolTx(address);
      setTxHash(hash);
      await waitForSuccess(hash);
      setTxStatus('success');
      return hash;
    } catch (err) {
      setTxStatus('failed');
      setTxError(
        err instanceof Error
          ? err.message
          : decodeContractError(err, contracts.arbitratorPanel.abi as Abi, 'joinPool'),
      );
      throw err;
    } finally {
      setBusy(false);
    }
  }, [address, resetTx]);

  return { stake, joinPool, busy, txStatus, txHash, txLabel, txError, resetTx };
}
