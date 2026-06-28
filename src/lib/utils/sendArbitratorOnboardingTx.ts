import { getAddress, type Abi, type Address } from 'viem';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { sendContractCall } from '@/lib/utils/sendContractCall';

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
