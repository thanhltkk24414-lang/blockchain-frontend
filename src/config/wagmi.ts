import { fallback, http } from 'wagmi';
import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';
import { createConfig } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const dappOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'https://fapex.app';

const primaryRpc =
  import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const fallbackRpc =
  import.meta.env.VITE_SEPOLIA_RPC_FALLBACK || 'https://rpc.sepolia.org';

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
    projectId: 'fapex-metamask-only',
  },
);

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors,
  transports: {
    [sepolia.id]: fallback([http(primaryRpc), http(fallbackRpc)], { rank: true }),
  },
  ssr: false,
  multiInjectedProviderDiscovery: false,
});
