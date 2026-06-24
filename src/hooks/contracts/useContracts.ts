import { useReadContract } from 'wagmi';
import { contracts } from '@/lib/contracts/config';

/** Read on-chain job counter — foundation hook for contract integration */
export function useJobCounter() {
  return useReadContract({
    ...contracts.jobRegistry,
    functionName: 'jobCounter',
  });
}

/** Read USDC balance for connected wallet */
export function useUsdcBalance(address?: `0x${string}`) {
  return useReadContract({
    ...contracts.mockUsdc,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
}
