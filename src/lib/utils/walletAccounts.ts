import { getAddress, isAddress, type Address } from 'viem';
import { getMetaMaskProvider, type EthereumProvider } from '@/lib/utils/ethereumProvider';

export type WalletAccountSnapshot = {
  rainbowKitAddress: Address | null;
  metaMaskActive: Address | null;
  /** RainbowKit (wagmi) address differs from MetaMask extension selected account. */
  rainbowMismatch: boolean;
  /** SIWE session wallet differs from MetaMask active account used for signing. */
  siweMismatch: boolean;
};

function normalizeAccounts(raw: unknown): Address[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is string => typeof a === 'string' && isAddress(a))
    .map((a) => getAddress(a));
}

/** Read accounts MetaMask will sign with (no popup). */
export async function getMetaMaskAccounts(
  provider: EthereumProvider = getMetaMaskProvider()!,
): Promise<Address[]> {
  if (!provider?.request) return [];
  const raw = await provider.request({ method: 'eth_accounts' });
  return normalizeAccounts(raw);
}

/** Prompt MetaMask account access if needed; returns authorized accounts. */
export async function requestMetaMaskAccounts(
  provider: EthereumProvider = getMetaMaskProvider()!,
): Promise<Address[]> {
  if (!provider?.request) {
    throw new Error('MetaMask provider không khả dụng — cài/kích hoạt extension và refresh trang.');
  }
  const raw = await provider.request({ method: 'eth_requestAccounts' });
  const accounts = normalizeAccounts(raw);
  if (accounts.length === 0) {
    throw new Error('MetaMask không trả về account — mở extension và chọn tài khoản.');
  }
  return accounts;
}

/** Re-authorize eth_accounts via wallet_requestPermissions (recovery path). */
export async function requestMetaMaskPermissions(
  provider: EthereumProvider = getMetaMaskProvider()!,
): Promise<Address[]> {
  if (!provider?.request) {
    throw new Error('MetaMask provider không khả dụng.');
  }
  await provider.request({
    method: 'wallet_requestPermissions',
    params: [{ eth_accounts: {} }],
  });
  return requestMetaMaskAccounts(provider);
}

/**
 * Account MetaMask will use for eth_sendTransaction — always eth_accounts[0]
 * after eth_requestAccounts, never wagmi/RainbowKit cache alone.
 */
export async function resolveMetaMaskSigningAccount(options?: {
  requestPermissions?: boolean;
}): Promise<Address> {
  const provider = getMetaMaskProvider();
  if (!provider) {
    throw new Error('MetaMask provider không khả dụng — cài/kích hoạt extension và refresh trang.');
  }

  if (options?.requestPermissions) {
    const accounts = await requestMetaMaskPermissions(provider);
    return accounts[0];
  }

  let accounts = await getMetaMaskAccounts(provider);
  if (accounts.length === 0) {
    accounts = await requestMetaMaskAccounts(provider);
  }
  return accounts[0];
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function buildWalletSnapshot(
  rainbowKitAddress: string | null | undefined,
  metaMaskActive: string | null | undefined,
  siweWallet: string | null | undefined,
): WalletAccountSnapshot {
  const rk = rainbowKitAddress && isAddress(rainbowKitAddress) ? getAddress(rainbowKitAddress) : null;
  const mm =
    metaMaskActive && isAddress(metaMaskActive) ? getAddress(metaMaskActive) : null;
  const siwe = siweWallet && isAddress(siweWallet) ? getAddress(siweWallet) : null;

  return {
    rainbowKitAddress: rk,
    metaMaskActive: mm,
    rainbowMismatch: Boolean(rk && mm && rk.toLowerCase() !== mm.toLowerCase()),
    siweMismatch: Boolean(siwe && mm && siwe.toLowerCase() !== mm.toLowerCase()),
  };
}

export function isInvalidTxParamsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: number })?.code;
  return code === -32602 || /missing or invalid parameters/i.test(msg);
}
