import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { zeroAddress, type Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { computeTotalDeposit, toUsdcUnits } from '@/lib/utils/usdc';
import { executeContractWrite, decodeContractError } from '@/lib/utils/contractWrite';
import {
  explainDepositBlocker,
  isNonZeroAddress,
  type OnChainJob,
} from '@/lib/utils/onchainJob';
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

  const readOnChainJob = useCallback(async (onchainJobId: number): Promise<OnChainJob> => {
    return (await readContract(wagmiConfig, {
      ...contracts.jobRegistry,
      functionName: 'getJob',
      args: [BigInt(onchainJobId)],
    })) as OnChainJob;
  }, []);

  const deposit = useCallback(
    async ({ onchainJobId, freelancerAddress, contractValue }: EscrowDepositParams) => {
      if (!address) throw new Error('Connect your wallet first');
      if (!isNonZeroAddress(freelancerAddress)) {
        throw new Error('Địa chỉ freelancer không hợp lệ (không được dùng 0x0).');
      }

      const totalAmount = totalForValue(contractValue);
      resetTx();
      setTxStatus('pending');

      try {
        const onChainJob = await readOnChainJob(onchainJobId);
        const blocker = explainDepositBlocker(onChainJob);
        if (blocker) {
          throw new Error(blocker);
        }
        if (onChainJob.client.toLowerCase() !== address.toLowerCase()) {
          throw new Error(
            `Chỉ client on-chain ${onChainJob.client.slice(0, 6)}…${onChainJob.client.slice(-4)} mới nạp escrow.`,
          );
        }

        const allowance = (await readContract(wagmiConfig, {
          ...contracts.mockUsdc,
          functionName: 'allowance',
          args: [address, CONTRACT_ADDRESSES.EscrowVault],
        })) as bigint;

        if (allowance < totalAmount) {
          setTxLabel('Approving USDC for EscrowVault…');
          const approveHash = await executeContractWrite(writeContractAsync, {
            address: contracts.mockUsdc.address,
            abi: contracts.mockUsdc.abi as Abi,
            functionName: 'approve',
            args: [CONTRACT_ADDRESSES.EscrowVault, totalAmount],
            account: address,
          });
          setTxHash(approveHash);
          await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
        }

        setTxLabel('Depositing escrow on-chain…');
        const depositHash = await executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'depositEscrow',
          args: [BigInt(onchainJobId), freelancerAddress],
          account: address,
        });
        setTxHash(depositHash);
        await waitForTransactionReceipt(wagmiConfig, { hash: depositHash });

        setTxStatus('success');
        setTxLabel('Escrow deposited successfully');
      } catch (err) {
        setTxStatus('failed');
        const message =
          err instanceof Error ? err.message : decodeContractError(err, contracts.escrowVault.abi as Abi);
        setTxError(message);
        throw err;
      }
    },
    [address, readOnChainJob, resetTx, totalForValue, writeContractAsync],
  );

  return {
    deposit,
    readOnChainJob,
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

export { zeroAddress };
