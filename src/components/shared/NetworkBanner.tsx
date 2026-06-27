import { useEffect, useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { CHAIN_ID } from '@/lib/contracts/addresses';

export function NetworkBanner() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [flash, setFlash] = useState(false);

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;

  useEffect(() => {
    const provider = (window as Window & { ethereum?: { on?: (e: string, fn: () => void) => void; removeListener?: (e: string, fn: () => void) => void } }).ethereum;
    if (!provider?.on) return;

    const onChainChanged = () => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 2500);
    };

    provider.on('chainChanged', onChainChanged);
    return () => provider.removeListener?.('chainChanged', onChainChanged);
  }, []);

  if (!wrongNetwork) return null;

  return (
    <div
      className={`network-banner${flash ? ' network-banner-flash' : ''}`}
      role="alert"
    >
      <div className="network-banner-inner">
        <p>
          <strong>Sai mạng.</strong> FAPEX chạy trên Sepolia (chainId {CHAIN_ID}) — ví đang ở{' '}
          {chainId ?? 'unknown'}.
        </p>
        <button
          type="button"
          className="btn primary compact"
          disabled={isPending}
          onClick={() => void switchChainAsync({ chainId: CHAIN_ID })}
        >
          {isPending ? 'Đang chuyển…' : 'Chuyển sang Sepolia'}
        </button>
      </div>
    </div>
  );
}
