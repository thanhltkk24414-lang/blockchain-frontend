import type { Abi, Address } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import { getAccount, sendTransaction, simulateContract } from '@wagmi/core/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { decodeContractError, logContractError } from '@/lib/utils/contractWrite';

export type SendFinalizeDisputeTxParams = {
  onchainJobId: bigint;
  account?: Address;
};

function escrowVaultAddress(): Address {
  return getAddress(contracts.escrowVault.address);
}

export async function sendFinalizeDisputeTx({
  onchainJobId,
  account: connectedHint,
}: SendFinalizeDisputeTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const to = escrowVaultAddress();
  const args = [onchainJobId] as const;

  const { address, status, chainId: connectedChainId } = getAccount(wagmiConfig);
  if (status !== 'connected' || !address) {
    throw new Error('Kết nối ví MetaMask trên Sepolia trước khi finalize dispute.');
  }

  const signingAccount = getAddress(address);

  if (
    connectedHint &&
    signingAccount.toLowerCase() !== connectedHint.toLowerCase() &&
    import.meta.env.DEV
  ) {
    console.warn('[finalizeDisputeVoting] wagmi account hint mismatch', {
      connectedHint,
      signingAccount,
    });
  }

  if (connectedChainId != null && connectedChainId !== chainId) {
    throw new Error(
      `MetaMask phải ở Sepolia (chainId ${chainId}) — hiện tại: ${connectedChainId}.`,
    );
  }

  const data = encodeFunctionData({
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'finalizeDisputeVoting',
    args: [...args],
  });

  try {
    await simulateContract(wagmiConfig, {
      address: to,
      abi: contracts.escrowVault.abi as Abi,
      functionName: 'finalizeDisputeVoting',
      args: [...args],
      account: signingAccount,
      chainId,
    });
  } catch (simErr) {
    logContractError('finalizeDisputeVoting simulateContract', simErr);
    throw new Error(
      decodeContractError(simErr, contracts.escrowVault.abi as Abi, 'finalizeDisputeVoting'),
    );
  }

  try {
    return await sendTransaction(wagmiConfig, { chainId, to, data });
  } catch (err) {
    logContractError('finalizeDisputeVoting sendTransaction', err);
    throw new Error(
      decodeContractError(err, contracts.escrowVault.abi as Abi, 'finalizeDisputeVoting'),
    );
  }
}
