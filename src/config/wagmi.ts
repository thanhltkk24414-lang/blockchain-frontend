import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const dappOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'https://fapex.app';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'MetaMask',
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: 'Fapex',
    appUrl: dappOrigin,
    // WalletConnect unused — MetaMask-only; RainbowKit API still requires a projectId string.
    projectId: 'fapex-metamask-only',
  },
);

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: http(),
  },
  ssr: false,
  // Critical on Windows when Coinbase/Brave/Rabby inject alongside MetaMask.
  multiInjectedProviderDiscovery: false,
});
