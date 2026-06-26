import type { Abi, Address } from 'viem';
import { contracts } from '@/lib/contracts/config';
import { sendContractTransaction } from '@/lib/utils/contractWrite';

export type SendCreateJobTxParams = {
  metadataCID: string;
  contractValueUnits: bigint;
  durationSeconds: bigint;
  account: Address;
};

/**
 * Dedicated createJob signer — separated from generic hooks so MetaMask fallbacks
 * (walletClient → wagmi → eth_sendTransaction) stay in one place for JobRegistry.
 */
export async function sendCreateJobTx({
  metadataCID,
  contractValueUnits,
  durationSeconds,
  account,
}: SendCreateJobTxParams): Promise<`0x${string}`> {
  return sendContractTransaction({
    address: contracts.jobRegistry.address,
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [metadataCID.trim(), contractValueUnits, durationSeconds],
    account,
  });
}
