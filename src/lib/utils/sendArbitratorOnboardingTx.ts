import { getAccount, sendTransaction, simulateContract } from '@wagmi/core/actions';
import { encodeFunctionData, getAddress, type Abi, type Address } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID, CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { decodeContractError, logContractError } from '@/lib/utils/contractWrite';

type ContractCallParams = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
};

/**
 * MetaMask-safe contract write — preflight via simulateContract, sign via wagmi sendTransaction
 * (same pattern as sendCreateJobTx; avoids writeContract / eth_sendTransaction param issues).
 */
async function sendContractCall({
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

  if (import.meta.env.DEV) {
    console.debug(`[${functionName}] preflight OK`, { signingAccount, to, chainId });
  }

  try {
    const hash = await sendTransaction(wagmiConfig, {
      chainId,
      to,
      data,
    });
    if (import.meta.env.DEV) {
      console.debug(`[${functionName}] sendTransaction OK`, hash);
    }
    return hash;
  } catch (err) {
    logContractError(`${functionName} sendTransaction`, err);
    throw new Error(decodeContractError(err, abi, functionName));
  }
}

export async function sendApproveUsdcTx(
  spender: Address,
  amountUnits: bigint,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.MockUSDC,
    abi: contracts.mockUsdc.abi as Abi,
    functionName: 'approve',
    args: [getAddress(spender), amountUnits],
  });
}

export async function sendStakeAsArbitratorTx(amountUnits: bigint): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.PlatformTreasury,
    abi: contracts.platformTreasury.abi as Abi,
    functionName: 'stakeAsArbitrator',
    args: [amountUnits],
  });
}

export async function sendJoinPoolTx(arbitrator: Address): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.ArbitratorPanel,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'joinPool',
    args: [getAddress(arbitrator)],
  });
}
