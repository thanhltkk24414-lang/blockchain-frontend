import { estimateGas } from 'viem/actions';
import type { Abi, Address } from 'viem';
import { wagmiConfig } from '@/config/wagmi';

const DEFAULT_GAS_CAP = 300_000n;
const GAS_BUFFER_NUM = 12n;
const GAS_BUFFER_DEN = 10n;

export type GasEstimateInput = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account?: Address;
  value?: bigint;
};

/**
 * Estimate gas with a 20% buffer and cap at 300k to avoid Infura "gas limit too high"
 * on reverts that wagmi/MetaMask may over-estimate.
 */
export async function withGasLimit(params: GasEstimateInput): Promise<{ gas: bigint }> {
  const client = wagmiConfig.getClient();
  const account = params.account ?? client.account?.address;
  if (!account) {
    return { gas: DEFAULT_GAS_CAP };
  }

  try {
    const estimated = await estimateGas(client, {
      ...params,
      account,
    } as Parameters<typeof estimateGas>[1]);
    const buffered = (estimated * GAS_BUFFER_NUM) / GAS_BUFFER_DEN;
    const gas = buffered > DEFAULT_GAS_CAP ? DEFAULT_GAS_CAP : buffered;
    return { gas: gas > 0n ? gas : DEFAULT_GAS_CAP };
  } catch {
    return { gas: DEFAULT_GAS_CAP };
  }
}
