import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'MetaMask',
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: 'Fapex',
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
});
