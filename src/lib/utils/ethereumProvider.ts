export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

/**
 * MetaMask EIP-1193 provider.
 * With multiple browser wallets installed, prefer `window.ethereum` (the site-connected
 * aggregator) over `ethereum.providers[i]` — isolated sub-providers often lack site
 * permission and return -32602 even when eth_accounts looks correct on the sub-provider.
 */
export function getMetaMaskProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth?.request) return undefined;

  if (eth.isMetaMask) return eth;

  const hasMetaMaskBundle = eth.providers?.some((p: EthereumProvider) => p.isMetaMask && p.request);
  if (hasMetaMaskBundle) return eth;

  return eth.providers?.find((p: EthereumProvider) => p.isMetaMask && p.request);
}

/** Provider RainbowKit/wagmi authorized for this origin — preferred for signing. */
export async function getSigningProvider(): Promise<EthereumProvider | undefined> {
  try {
    const { getAccount } = await import('wagmi/actions');
    const { wagmiConfig } = await import('@/config/wagmi');
    const connector = getAccount(wagmiConfig).connector;
    if (connector && 'getProvider' in connector && typeof connector.getProvider === 'function') {
      const p = (await connector.getProvider()) as EthereumProvider | undefined;
      if (p?.request) return p;
    }
  } catch {
    // fall through to injected MetaMask
  }
  return getMetaMaskProvider();
}

export const SEPOLIA_CHAIN_ID_HEX = '0xaa36a7';

export async function ensureSepoliaOnProvider(provider: EthereumProvider): Promise<void> {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      throw new Error('Sepolia is not in MetaMask — add the Sepolia testnet network.');
    }
    throw err;
  }
}
