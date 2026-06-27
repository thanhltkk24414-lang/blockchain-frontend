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
        throw new Error('Invalid freelancer address (0x0 is not allowed).');
      }
      if (expectedFreelancer && !addressesEqual(freelancer, expectedFreelancer)) {
        throw new Error(
          `Freelancer for deposit (${freelancer}) must match the accepted bid (${getAddress(expectedFreelancer)}).`,
        );
      }
      if (freelancer.toLowerCase() === getAddress(address).toLowerCase()) {
        throw new Error('Freelancer cannot be the same wallet as the on-chain client.');
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
            `Only on-chain client ${onChainJob.client.slice(0, 6)}…${onChainJob.client.slice(-4)} can deposit escrow.`,
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
            throw new Error('USDC approve failed on-chain.');
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
            'depositEscrow reverted on-chain — verify the job is still OPEN and allowance is sufficient (price + 3%).',
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
