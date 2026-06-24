import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { computeTotalDeposit, toUsdcUnits } from '@/lib/utils/usdc';
import type { TxStatus } from '@/components/shared/TxStatusModal';

interface EscrowDepositParams {
  onchainJobId: number;
  freelancerAddress: `0x${string}`;
  contractValue: number;
}

export function useEscrowDeposit() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();

  const totalForValue = useCallback((contractValue: number) => {
    return toUsdcUnits(computeTotalDeposit(contractValue));
  }, []);

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
  }, []);

  const deposit = useCallback(
    async ({ onchainJobId, freelancerAddress, contractValue }: EscrowDepositParams) => {
      if (!address) throw new Error('Connect your wallet first');

      const totalAmount = totalForValue(contractValue);
      resetTx();
      setTxStatus('pending');

      try {
        const allowance = (await readContract(wagmiConfig, {
          ...contracts.mockUsdc,
          functionName: 'allowance',
          args: [address, CONTRACT_ADDRESSES.EscrowVault],
        })) as bigint;

        if (allowance < totalAmount) {
          setTxLabel('Approving USDC for EscrowVault…');
          const approveHash = await writeContractAsync({
            ...contracts.mockUsdc,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, totalAmount],
          });
          setTxHash(approveHash);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }

        setTxLabel('Depositing escrow on-chain…');
        const depositHash = await writeContractAsync({
          ...contracts.escrowVault,
          functionName: 'depositEscrow',
          args: [BigInt(onchainJobId), freelancerAddress],
        });
        setTxHash(depositHash);
        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });

        setTxStatus('success');
        setTxLabel('Escrow deposited successfully');
      } catch (err) {
        setTxStatus('failed');
        setTxError(err instanceof Error ? err.message : 'Transaction failed');
        throw err;
      }
    },
    [address, resetTx, totalForValue, writeContractAsync],
  );

  return {
    deposit,
    txStatus,
    txHash,
    txLabel,
    txError,
    resetTx,
    totalDepositUsdc: (contractValue: number) => computeTotalDeposit(contractValue),
  };
}

/** Read current USDC allowance for escrow vault */
export function useUsdcAllowance(owner?: `0x${string}`) {
  return useReadContract({
    ...contracts.mockUsdc,
    functionName: 'allowance',
    args: owner ? [owner, CONTRACT_ADDRESSES.EscrowVault] : undefined,
    query: { enabled: Boolean(owner) },
  });
}
