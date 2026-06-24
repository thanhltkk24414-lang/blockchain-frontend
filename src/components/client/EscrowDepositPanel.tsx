import { useState } from 'react';
import { useAccount } from 'wagmi';
import type { Job } from '@/lib/api';
import { useEscrowDeposit } from '@/hooks/useEscrowDeposit';
import { useUsdcBalance } from '@/hooks/contracts/useContracts';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { isAddress } from 'viem';

interface EscrowDepositPanelProps {
  job: Job;
}

function resolveClientAddress(job: Job): string | null {
  if (job.clientAddress) return job.clientAddress.toLowerCase();
  if (typeof job.client === 'object' && job.client?.walletAddress) {
    return job.client.walletAddress.toLowerCase();
  }
  if (typeof job.client === 'string') return job.client.toLowerCase();
  return null;
}

function resolveFreelancerAddress(job: Job): string | null {
  if (job.freelancerAddress) return job.freelancerAddress;
  if (typeof job.freelancer === 'object' && job.freelancer?.walletAddress) {
    return job.freelancer.walletAddress;
  }
  return null;
}

export function EscrowDepositPanel({ job }: EscrowDepositPanelProps) {
  const { address, isConnected } = useAccount();
  const clientAddr = resolveClientAddress(job);
  const isClient = Boolean(
    address && clientAddr && address.toLowerCase() === clientAddr,
  );
  const existingFreelancer = resolveFreelancerAddress(job);
  const [freelancerInput, setFreelancerInput] = useState(existingFreelancer ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  const { deposit, txStatus, txHash, txLabel, txError, resetTx, totalDepositUsdc } =
    useEscrowDeposit();
  const { data: balance } = useUsdcBalance(address);

  if (!isValidOnchainJobId(job.onchainJobId) || !isClient) {
    return null;
  }

  const contractValue = job.contractValue ?? 0;
  const totalDeposit = job.totalDeposit ?? totalDepositUsdc(contractValue);
  const balanceUsdc =
    balance != null ? Number(balance) / 1_000_000 : null;

  async function handleDeposit() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Connect your wallet on Sepolia.');
      return;
    }
    if (!job.onchainJobId || !contractValue) {
      setLocalError('Job is missing on-chain id or contract value.');
      return;
    }
    const freelancer = freelancerInput.trim();
    if (!isAddress(freelancer)) {
      setLocalError('Enter a valid freelancer wallet address (0x…).');
      return;
    }

    setDepositing(true);
    try {
      await deposit({
        onchainJobId: job.onchainJobId,
        freelancerAddress: freelancer as `0x${string}`,
        contractValue,
      });
    } catch {
      // tx state handled in hook
    } finally {
      setDepositing(false);
    }
  }

  return (
    <section className="panel escrow-panel">
      <h3>Fund escrow (USDC)</h3>
      <p className="muted">
        Approve MockUSDC and call <code>depositEscrow</code> on EscrowVault. Total includes 3%
        platform fee.
      </p>

      <dl className="detail-grid">
        <dt>Contract value</dt>
        <dd>{contractValue} USDC</dd>
        <dt>Total deposit</dt>
        <dd>{totalDeposit} USDC</dd>
        {balanceUsdc != null && (
          <>
            <dt>Your USDC balance</dt>
            <dd>{balanceUsdc.toLocaleString()} USDC</dd>
          </>
        )}
      </dl>

      {!existingFreelancer && (
        <div className="field">
          <label htmlFor="freelancer-addr">Freelancer address</label>
          <input
            id="freelancer-addr"
            className="input full"
            value={freelancerInput}
            onChange={(e) => setFreelancerInput(e.target.value)}
            placeholder="0x… (from accepted proposal — manual for demo)"
          />
          <span className="muted phase-note">
            Pre-filled from accepted proposal when available.
          </span>
        </div>
      )}

      {localError && <p className="error">{localError}</p>}

      <button
        className="btn primary"
        type="button"
        onClick={handleDeposit}
        disabled={depositing || txStatus === 'pending'}
      >
        {depositing || txStatus === 'pending' ? 'Processing…' : 'Approve & deposit escrow'}
      </button>

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </section>
  );
}
