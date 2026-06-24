import { CHAIN_ID } from '@/lib/contracts/addresses';

const EXPLORER_BASE: Record<number, string> = {
  11155111: 'https://sepolia.etherscan.io',
};

export function etherscanBaseUrl(chainId = CHAIN_ID): string {
  return EXPLORER_BASE[chainId] ?? 'https://sepolia.etherscan.io';
}

export function etherscanTxUrl(hash: string, chainId = CHAIN_ID): string {
  return `${etherscanBaseUrl(chainId)}/tx/${hash}`;
}

export function etherscanAddressUrl(address: string, chainId = CHAIN_ID): string {
  return `${etherscanBaseUrl(chainId)}/address/${address}`;
}

export function shortenHash(hash: string, chars = 6): string {
  if (!hash || hash.length < chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

/** On-chain job IDs from JobRegistry are small sequential integers; backend fallback uses timestamps. */
export function isValidOnchainJobId(id?: number | null): boolean {
  return id != null && id > 0 && id < 10_000_000;
}
