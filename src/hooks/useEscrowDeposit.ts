import { useCallback, useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { zeroAddress, type Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { escrowTotalFromOnChain, fromUsdcUnits } from '@/lib/utils/usdc';
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
}

export function useEscrowDeposit() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
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

  const readOnChainJob = useCallback(async (onchainJobId: number): Promise<OnChainJob> => {
    return (await readContract(wagmiConfig, {
      ...contracts.jobRegistry,
      functionName: 'getJob',
      args: [BigInt(onchainJobId)],
    })) as OnChainJob;
  }, []);

  const deposit = useCallback(
    async ({ onchainJobId, freelancerAddress }: EscrowDepositParams) => {
      if (!address) throw new Error('Connect your wallet first');
      if (!isNonZeroAddress(freelancerAddress)) {
        throw new Error('Địa chỉ freelancer không hợp lệ (không được dùng 0x0).');
      }
      if (freelancerAddress.toLowerCase() === address.toLowerCase()) {
        throw new Error('Freelancer không thể trùng ví client on-chain.');
      }

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

        const totalAmount = escrowTotalFromOnChain(onChainJob.contractValue);

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
          const approveReceipt = await waitForTransactionReceipt(wagmiConfig, {
            hash: approveHash,
          });
          if (approveReceipt.status === 'reverted') {
            throw new Error('Approve USDC thất bại on-chain.');
          }
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
        const depositReceipt = await waitForTransactionReceipt(wagmiConfig, {
          hash: depositHash,
        });
        if (depositReceipt.status === 'reverted') {
          throw new Error(
            'depositEscrow revert on-chain — kiểm tra job còn OPEN và allowance đủ (giá + 3%).',
          );
        }

        setTxStatus('success');
        setTxLabel('Escrow deposited successfully');
      } catch (err) {
        setTxStatus('failed');
        const message =
          err instanceof Error
            ? err.message
            : decodeContractError(err, contracts.escrowVault.abi as Abi);
        setTxError(message);
        throw err;
      }
    },
    [address, readOnChainJob, resetTx, writeContractAsync],
  );

  return {
    deposit,
    readOnChainJob,
    txStatus,
    txHash,
    txLabel,
    txError,
    resetTx,
    escrowTotalFromOnChain,
    fromUsdcUnits,
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
