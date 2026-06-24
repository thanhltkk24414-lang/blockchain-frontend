import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { WALLETCONNECT_PROJECT_ID } from './env';

export const wagmiConfig = getDefaultConfig({
  appName: 'Fapex',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
  ssr: false,
});
