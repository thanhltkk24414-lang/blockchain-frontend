import { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAuth } from '@/context/AuthContext';
import {
  buildWalletSnapshot,
  getMetaMaskAccounts,
  shortAddress,
  type WalletAccountSnapshot,
} from '@/lib/utils/walletAccounts';
import { getSigningProvider } from '@/lib/utils/ethereumProvider';

export function useWalletAccountSync() {
  const { address: rainbowKitAddress, isConnected } = useAccount();
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<WalletAccountSnapshot>(() =>
    buildWalletSnapshot(null, null, null),
  );

  const refresh = useCallback(async () => {
    const provider = await getSigningProvider();
    if (!provider) {
      setSnapshot(buildWalletSnapshot(rainbowKitAddress, null, user?.walletAddress));
      return;
    }
    try {
      const accounts = await getMetaMaskAccounts(provider);
      const active = accounts[0] ?? null;
      setSnapshot(buildWalletSnapshot(rainbowKitAddress, active, user?.walletAddress));
    } catch {
      setSnapshot(buildWalletSnapshot(rainbowKitAddress, null, user?.walletAddress));
    }
  }, [rainbowKitAddress, user?.walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh, isConnected]);

  useEffect(() => {
    const eth = (window as Window & {
      ethereum?: {
        on?: (e: string, fn: () => void) => void;
        removeListener?: (e: string, fn: () => void) => void;
      };
    }).ethereum;
    if (!eth?.on) return;
    const onAccountsChanged = () => {
      void refresh();
    };
    eth.on('accountsChanged', onAccountsChanged);
    return () => {
      eth.removeListener?.('accountsChanged', onAccountsChanged);
    };
  }, [refresh]);

  const signingAddress = snapshot.metaMaskActive ?? snapshot.rainbowKitAddress;

  return {
    rainbowKitAddress: snapshot.rainbowKitAddress,
    metaMaskActive: snapshot.metaMaskActive,
    signingAddress,
    rainbowMismatch: snapshot.rainbowMismatch,
    siweMismatch: snapshot.siweMismatch,
    siweWallet: user?.walletAddress ?? null,
    shortRainbow: snapshot.rainbowKitAddress ? shortAddress(snapshot.rainbowKitAddress) : null,
    shortMetaMask: snapshot.metaMaskActive ? shortAddress(snapshot.metaMaskActive) : null,
    shortSiwe: user?.walletAddress ? shortAddress(user.walletAddress) : null,
    refresh,
  };
}
