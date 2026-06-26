import { useCallback, useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { getAddress, zeroAddress, type Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { escrowTotalFromOnChain, fromUsdcUnits } from '@/lib/utils/usdc';
import { executeContractWrite, decodeContractError } from '@/lib/utils/contractWrite';
import { addressesEqual } from '@/lib/utils/address';
import {
  explainDepositBlocker,
  explainRegistryMismatch,
  hasRegistryClientMismatch,
  isNonZeroAddress,
  type OnChainJob,
} from '@/lib/utils/onchainJob';
import type { TxStatus } from '@/components/shared/TxStatusModal';

interface EscrowDepositParams {
  onchainJobId: number;
  freelancerAddress: `0x${string}`;
  expectedFreelancer?: string;
  /** From API when backend registry differs from frontend read. */
  expectedOnchainClient?: string | null;
}

export function useEscrowDeposit() {
  const { address } = useAccount();
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

  /** Heuristic: vault USDC balance covers this job's expected deposit (demo-friendly). */
  const checkEscrowFunded = useCallback(async (contractValueUnits: bigint): Promise<boolean> => {
    if (contractValueUnits <= 0n) return false;
    const balance = (await readContract(wagmiConfig, {
      ...contracts.mockUsdc,
      functionName: 'balanceOf',
      args: [CONTRACT_ADDRESSES.EscrowVault],
    })) as bigint;
    return balance >= escrowTotalFromOnChain(contractValueUnits);
  }, []);

  const deposit = useCallback(
    async ({ onchainJobId, freelancerAddress, expectedFreelancer, expectedOnchainClient }: EscrowDepositParams) => {
      if (!address) throw new Error('Connect your wallet first');
      const freelancer = getAddress(freelancerAddress);
      if (!isNonZeroAddress(freelancer)) {
        throw new Error('Địa chỉ freelancer không hợp lệ (không được dùng 0x0).');
      }
      if (expectedFreelancer && !addressesEqual(freelancer, expectedFreelancer)) {
        throw new Error(
          `Freelancer deposit (${freelancer}) phải trùng bid đã accept (${getAddress(expectedFreelancer)}).`,
        );
      }
      if (freelancer.toLowerCase() === getAddress(address).toLowerCase()) {
        throw new Error('Freelancer không thể trùng ví client on-chain.');
      }

      resetTx();
      setTxStatus('pending');

      try {
        const onChainJob = await readOnChainJob(onchainJobId);
        if (
          hasRegistryClientMismatch(onChainJob.client, expectedOnchainClient) &&
          expectedOnchainClient
        ) {
          throw new Error(
            explainRegistryMismatch(
              onchainJobId,
              CONTRACT_ADDRESSES.JobRegistry,
              expectedOnchainClient,
              onChainJob.client,
            ),
          );
        }
        const escrowFunded = await checkEscrowFunded(onChainJob.contractValue);
        const blocker = explainDepositBlocker(onChainJob, { escrowFunded });
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
          const approveHash = await executeContractWrite({
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
        const depositHash = await executeContractWrite({
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'depositEscrow',
          args: [BigInt(onchainJobId), freelancer],
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
    [address, checkEscrowFunded, readOnChainJob, resetTx],
  );

  return {
    deposit,
    readOnChainJob,
    checkEscrowFunded,
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
