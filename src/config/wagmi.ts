import { metaMask } from 'wagmi/connectors';
import { createConfig, http } from 'wagmi';
import { sepolia } from 'wagmi/chains';

const dappOrigin =
  typeof window !== 'undefined' ? window.location.origin : 'https://fapex.app';

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'Fapex',
        url: dappOrigin,
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
  ssr: false,
  // Critical on Windows when Coinbase/Brave/Rabby inject alongside MetaMask.
  multiInjectedProviderDiscovery: false,
});
