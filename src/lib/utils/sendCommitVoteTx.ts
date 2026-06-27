import type { Abi, Address } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import { getAccount, sendTransaction, simulateContract } from '@wagmi/core/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { decodeContractError, logContractError } from '@/lib/utils/contractWrite';

export type SendCommitVoteTxParams = {
  onchainJobId: bigint;
  voteHash: `0x${string}`;
  account?: Address;
};

function arbitratorPanelAddress(): Address {
  return getAddress(contracts.arbitratorPanel.address);
}

export async function sendCommitVoteTx({
  onchainJobId,
  voteHash,
  account: connectedHint,
}: SendCommitVoteTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const to = arbitratorPanelAddress();
  const args = [onchainJobId, voteHash] as const;

  const { address, status, chainId: connectedChainId } = getAccount(wagmiConfig);
  if (status !== 'connected' || !address) {
    throw new Error('Kết nối ví MetaMask trên Sepolia trước khi commit vote.');
  }

  const signingAccount = getAddress(address);

  if (
    connectedHint &&
    signingAccount.toLowerCase() !== connectedHint.toLowerCase() &&
    import.meta.env.DEV
  ) {
    console.warn('[commitVote] wagmi account hint mismatch', { connectedHint, signingAccount });
  }

  if (connectedChainId != null && connectedChainId !== chainId) {
    throw new Error(
      `MetaMask phải ở Sepolia (chainId ${chainId}) — hiện tại: ${connectedChainId}.`,
    );
  }

  const data = encodeFunctionData({
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'commitVote',
    args: [...args],
  });

  try {
    await simulateContract(wagmiConfig, {
      address: to,
      abi: contracts.arbitratorPanel.abi as Abi,
      functionName: 'commitVote',
      args: [...args],
      account: signingAccount,
      chainId,
    });
  } catch (simErr) {
    logContractError('commitVote simulateContract', simErr);
    throw new Error(
      decodeContractError(simErr, contracts.arbitratorPanel.abi as Abi, 'commitVote'),
    );
  }

  try {
    return await sendTransaction(wagmiConfig, { chainId, to, data });
  } catch (err) {
    logContractError('commitVote sendTransaction', err);
    throw new Error(
      decodeContractError(err, contracts.arbitratorPanel.abi as Abi, 'commitVote'),
    );
  }
}
