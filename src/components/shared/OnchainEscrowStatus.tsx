import { useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { escrowTotalFromOnChain } from '@/lib/utils/usdc';
import {
  onchainStatusLabel,
  ONCHAIN_JOB_STATUS,
  type OnChainJob,
} from '@/lib/utils/onchainJob';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

interface OnchainEscrowStatusProps {
  onchainJobId?: number;
  dbStatus?: string;
}

export function OnchainEscrowStatus({ onchainJobId, dbStatus }: OnchainEscrowStatusProps) {
  const [onchainStatus, setOnchainStatus] = useState<number | null>(null);
  const [escrowFunded, setEscrowFunded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isValidOnchainJobId(onchainJobId)) return;
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const onChainJob = (await readContract(wagmiConfig, {
          ...contracts.jobRegistry,
          functionName: 'getJob',
          args: [BigInt(onchainJobId!)],
        })) as OnChainJob;

        if (cancelled) return;
        setOnchainStatus(onChainJob.status);

        if (
          onChainJob.status === ONCHAIN_JOB_STATUS.ASSIGNED &&
          onChainJob.contractValue > 0n
        ) {
          const balance = (await readContract(wagmiConfig, {
            ...contracts.mockUsdc,
            functionName: 'balanceOf',
            args: [CONTRACT_ADDRESSES.EscrowVault],
          })) as bigint;
          if (!cancelled) {
            setEscrowFunded(balance >= escrowTotalFromOnChain(onChainJob.contractValue));
          }
        } else {
          setEscrowFunded(false);
        }
      } catch {
        if (!cancelled) {
          setOnchainStatus(null);
          setEscrowFunded(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onchainJobId]);

  if (!isValidOnchainJobId(onchainJobId)) return null;

  const showFunded =
    escrowFunded &&
    (onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED ||
      dbStatus?.toUpperCase() === 'ASSIGNED');

  if (loading && onchainStatus == null) {
    return <p className="muted phase-note">Checking on-chain escrow…</p>;
  }

  if (!showFunded) return null;

  return (
    <p className="success phase-note">
      <span className="badge success">Escrow funded</span>{' '}
      On-chain status: <strong>{onchainStatusLabel(onchainStatus!)}</strong> — USDC locked in
      EscrowVault.
    </p>
  );
}
