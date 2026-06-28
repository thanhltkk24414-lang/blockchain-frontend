import { getAccount, sendTransaction, simulateContract } from '@wagmi/core/actions';
import { encodeFunctionData, getAddress, type Abi, type Address } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { decodeContractError, logContractError } from '@/lib/utils/contractWrite';

export type ContractCallParams = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * MetaMask-safe contract write — preflight via simulateContract, sign via wagmi sendTransaction.
 */
export async function sendContractCall({
  address,
  abi,
  functionName,
  args = [],
}: ContractCallParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const to = getAddress(address);

  const { address: connected, status, chainId: connectedChainId } = getAccount(wagmiConfig);
  if (status !== 'connected' || !connected) {
    throw new Error('Connect your MetaMask wallet on Sepolia before sending a transaction.');
  }

  const signingAccount = getAddress(connected);

  if (connectedChainId != null && connectedChainId !== chainId) {
    throw new Error(
      `MetaMask must be on Sepolia (chainId ${chainId}) — currently: ${connectedChainId}.`,
    );
  }

  const data = encodeFunctionData({
    abi,
    functionName,
    args: [...args],
  });

  try {
    await simulateContract(wagmiConfig, {
      address: to,
      abi,
      functionName,
      args: [...args],
      account: signingAccount,
      chainId,
    });
  } catch (simErr) {
    logContractError(`${functionName} simulateContract`, simErr);
    throw new Error(decodeContractError(simErr, abi, functionName));
  }

  try {
    return await sendTransaction(wagmiConfig, {
      chainId,
      to,
      data,
    });
  } catch (err) {
    logContractError(`${functionName} sendTransaction`, err);
    throw new Error(decodeContractError(err, abi, functionName));
  }
}
