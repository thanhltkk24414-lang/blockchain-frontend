import { estimateGas } from 'viem/actions';
import type { Abi, Address } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { CHAIN_ID } from '@/lib/contracts/addresses';

const GAS_BUFFER_NUM = 12n;
const GAS_BUFFER_DEN = 10n;

/** Minimum gas for heavy escrow/registry writes (avoid under-estimate reverts). */
const GAS_MIN: Record<string, bigint> = {
  createJob: 120_000n,
  depositEscrow: 200_000n,
  startWork: 120_000n,
  /** Sepolia submitWork ~178k; 100k causes OOG masked as "unknown revert". */
  submitWork: 220_000n,
  /** Sepolia approveAndRelease ~224k; 200k OOG shows as undecoded revert. */
  approveAndRelease: 250_000n,
  /** Sepolia raiseDispute ~641k (sortition + 5× incrementActiveDispute); 400k OOG → undecoded revert. */
  raiseDispute: 700_000n,
  submitEvidence: 180_000n,
  /** PlatformTreasury.stakeAsArbitrator — ERC20 transferFrom + storage write. */
  stakeAsArbitrator: 120_000n,
  joinPool: 150_000n,
};

/** Per-function caps — avoids Infura "gas limit too high" on failed estimates. */
const GAS_CAPS: Record<string, bigint> = {
  approve: 80_000n,
  mint: 120_000n,
  transfer: 80_000n,
  depositEscrow: 400_000n,
  startWork: 180_000n,
  submitWork: 250_000n,
  approveAndRelease: 350_000n,
  raiseDispute: 900_000n,
  submitEvidence: 280_000n,
  assignFreelancer: 200_000n,
  createJob: 350_000n,
  submitProposal: 250_000n,
  stakeAsArbitrator: 200_000n,
  joinPool: 220_000n,
  default: 300_000n,
};

export type GasEstimateInput = {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  account?: Address;
  value?: bigint;
};

function capForFunction(functionName: string): bigint {
  return GAS_CAPS[functionName] ?? GAS_CAPS.default;
}

/**
 * Estimate gas with a 20% buffer and per-function cap.
 */
export async function withGasLimit(params: GasEstimateInput): Promise<{ gas: bigint }> {
  const cap = capForFunction(params.functionName);
  const client = wagmiConfig.getClient({ chainId: CHAIN_ID as 11155111 });
  const account = params.account ?? client.account?.address;
  if (!account) {
    return { gas: cap };
  }

  try {
    const estimated = await estimateGas(client, {
      ...params,
      account,
    } as Parameters<typeof estimateGas>[1]);
    const buffered = (estimated * GAS_BUFFER_NUM) / GAS_BUFFER_DEN;
    const min = GAS_MIN[params.functionName] ?? 0n;
    let gas = buffered > cap ? cap : buffered;
    if (gas < min) gas = min > cap ? cap : min;
    return { gas: gas > 0n ? gas : cap };
  } catch {
    return { gas: cap };
  }
}
