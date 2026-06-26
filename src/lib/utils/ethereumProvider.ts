export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

/** Prefer MetaMask when multiple injected wallets share window.ethereum (common on Windows). */
export function getMetaMaskProvider(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  if (!eth?.request) return undefined;
  if (eth.isMetaMask) return eth;
  const nested = eth.providers?.find((p: EthereumProvider) => p.isMetaMask && p.request);
  return nested ?? eth;
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
      throw new Error('Sepolia chưa có trong MetaMask — thêm mạng Sepolia testnet.');
    }
    throw err;
  }
}
