import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { getAddress, isAddress, zeroAddress } from 'viem';
import type { Bid, Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useEscrowDeposit } from '@/hooks/useEscrowDeposit';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { computeTotalDeposit, fromUsdcUnits } from '@/lib/utils/usdc';
import { DEMO_MINT_USDC, useMockUsdcMint } from '@/hooks/useMockUsdcMint';
import { useUsdcBalance } from '@/hooks/contracts/useContracts';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { etherscanAddressUrl, isValidOnchainJobId } from '@/lib/utils/etherscan';
import { addressesEqual, tryChecksumAddress } from '@/lib/utils/address';
import {
  explainDepositBlocker,
  explainRegistryMismatch,
  hasRegistryClientMismatch,
  isNonZeroAddress,
  onchainStatusLabel,
  ONCHAIN_JOB_STATUS,
} from '@/lib/utils/onchainJob';

interface EscrowDepositPanelProps {
  job: Job;
  bids?: Bid[];
}

function resolveClientAddress(job: Job): string | null {
  if (job.clientAddress) return job.clientAddress.toLowerCase();
  if (typeof job.client === 'object' && job.client?.walletAddress) {
    return job.client.walletAddress.toLowerCase();
  }
  if (typeof job.client === 'string') return job.client.toLowerCase();
  return null;
}

function resolveOnchainClientAddress(job: Job): string | null {
  return job.onchainClientAddress?.toLowerCase() ?? null;
}

function resolveFreelancerFromJob(job: Job): string | null {
  if (isNonZeroAddress(job.freelancerAddress)) return job.freelancerAddress;
  if (typeof job.freelancer === 'object' && isNonZeroAddress(job.freelancer?.walletAddress)) {
    return job.freelancer.walletAddress;
  }
  return null;
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function resolveAcceptedFreelancer(job: Job, bids: Bid[]): string | null {
  const fromJob = resolveFreelancerFromJob(job);
  if (fromJob) return tryChecksumAddress(fromJob) ?? fromJob;

  const accepted = bids.find((b) => b.status?.toLowerCase() === 'accepted');
  if (accepted && isNonZeroAddress(accepted.freelancerAddress)) {
    return tryChecksumAddress(accepted.freelancerAddress) ?? accepted.freelancerAddress;
  }

  if (job.status?.toUpperCase() === 'ASSIGNED') {
    const candidates = bids.filter((b) => b.status?.toLowerCase() !== 'rejected');
    if (candidates.length === 1 && isNonZeroAddress(candidates[0].freelancerAddress)) {
      return (
        tryChecksumAddress(candidates[0].freelancerAddress) ?? candidates[0].freelancerAddress
      );
    }
  }

  return null;
}

export function EscrowDepositPanel({ job, bids = [] }: EscrowDepositPanelProps) {
  const { address, isConnected } = useAccount();
  const { user, isAuthenticated } = useAuth();
  const clientAddr = resolveClientAddress(job);
  const onchainClientAddr = resolveOnchainClientAddress(job);
  const isApiClientOwner = Boolean(
    user?.walletAddress && clientAddr && user.walletAddress.toLowerCase() === clientAddr,
  );
  const isOnchainClient = Boolean(
    address &&
      onchainClientAddr &&
      address.toLowerCase() === onchainClientAddr,
  );
  const walletMismatch = Boolean(
    isConnected && onchainClientAddr && address && !isOnchainClient,
  );

  const acceptedFreelancer = useMemo(
    () => resolveAcceptedFreelancer(job, bids),
    [job, bids],
  );
  const [freelancerInput, setFreelancerInput] = useState(acceptedFreelancer ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [depositing, setDepositing] = useState(false);

  const {
    onchainJob,
    onchainStatus,
    onchainFreelancer,
    escrowFunded: onchainEscrowFunded,
    refetch: refetchOnchain,
  } = useOnChainJob(job.onchainJobId, job.status);

  const onchainBlocker = useMemo(
    () => (onchainJob ? explainDepositBlocker(onchainJob, { escrowFunded: onchainEscrowFunded }) : null),
    [onchainJob, onchainEscrowFunded],
  );

  const registryMismatch = useMemo(
    () => hasRegistryClientMismatch(onchainJob?.client, onchainClientAddr),
    [onchainJob?.client, onchainClientAddr],
  );

  const registryMismatchMessage = useMemo(() => {
    if (!registryMismatch || !onchainClientAddr || !job.onchainJobId) return null;
    return explainRegistryMismatch(
      job.onchainJobId,
      CONTRACT_ADDRESSES.JobRegistry,
      onchainClientAddr,
      onchainJob?.client,
    );
  }, [registryMismatch, onchainClientAddr, job.onchainJobId, onchainJob?.client]);

  const { deposit, txStatus, txHash, txLabel, txError, resetTx, escrowTotalFromOnChain } =
    useEscrowDeposit();

  const onchainContractValueUsdc =
    onchainJob != null ? fromUsdcUnits(onchainJob.contractValue) : null;
  const onchainTotalDepositUsdc =
    onchainJob != null
      ? fromUsdcUnits(escrowTotalFromOnChain(onchainJob.contractValue))
      : null;

  const {
    mint,
    minting,
    txStatus: mintTxStatus,
    txHash: mintTxHash,
    txError: mintTxError,
    resetTx: resetMintTx,
  } = useMockUsdcMint();
  const { data: balance, refetch: refetchBalance } = useUsdcBalance(address);

  useEffect(() => {
    if (acceptedFreelancer) {
      setFreelancerInput(acceptedFreelancer);
    }
  }, [acceptedFreelancer]);

  const onchainFreelancerCs = isNonZeroAddress(onchainFreelancer)
    ? tryChecksumAddress(onchainFreelancer)
    : null;
  const acceptedVsOnchainMismatch = Boolean(
    acceptedFreelancer &&
      onchainFreelancerCs &&
      onchainStatus !== ONCHAIN_JOB_STATUS.OPEN &&
      !addressesEqual(acceptedFreelancer, onchainFreelancerCs),
  );

  if (!isValidOnchainJobId(job.onchainJobId) || !isAuthenticated || !isApiClientOwner) {
    return null;
  }

  const contractValue = job.contractValue ?? 0;
  const totalDeposit =
    onchainTotalDepositUsdc ?? job.totalDeposit ?? computeTotalDeposit(contractValue);
  const onChainValueMismatch =
    onchainContractValueUsdc != null &&
    contractValue > 0 &&
    Math.abs(onchainContractValueUsdc - contractValue) > 0.01;
  const balanceUsdc =
    balance != null ? Number(balance) / 1_000_000 : null;
  const insufficientUsdc =
    balanceUsdc != null && balanceUsdc < totalDeposit;
  const depositBlocked = Boolean(onchainBlocker) || registryMismatch;
  const escrowFunded = onchainEscrowFunded || txStatus === 'success';
  const depositComplete =
    escrowFunded &&
    onchainStatus === ONCHAIN_JOB_STATUS.ASSIGNED &&
    isNonZeroAddress(onchainFreelancer ?? acceptedFreelancer);
  const readyToDeposit =
    onchainStatus === ONCHAIN_JOB_STATUS.OPEN && !depositBlocked;

  const depositDisabledReason = useMemo(() => {
    if (depositComplete) return 'Escrow has been funded on-chain.';
    if (walletMismatch && onchainClientAddr) {
      return `Switch MetaMask to ${shortAddress(onchainClientAddr)} (wallet that created the on-chain job) to approve & deposit.`;
    }
    if (registryMismatch && registryMismatchMessage) return registryMismatchMessage;
    if (depositBlocked && onchainBlocker) return onchainBlocker;
    if (acceptedVsOnchainMismatch) {
      return 'On-chain freelancer does not match the accepted bid.';
    }
    if (insufficientUsdc) {
      return `Need ${totalDeposit} MockUSDC on the on-chain client wallet — mint below after switching to the correct wallet.`;
    }
    if (!acceptedFreelancer && !freelancerInput.trim()) {
      return 'Enter the freelancer address from the accepted proposal.';
    }
    return null;
  }, [
    depositComplete,
    walletMismatch,
    onchainClientAddr,
    registryMismatch,
    registryMismatchMessage,
    depositBlocked,
    onchainBlocker,
    acceptedVsOnchainMismatch,
    insufficientUsdc,
    totalDeposit,
    acceptedFreelancer,
    freelancerInput,
  ]);

  const showMintSection = insufficientUsdc;

  async function handleMint() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Connect your MetaMask wallet on the Sepolia network.');
      return;
    }
    try {
      await mint(DEMO_MINT_USDC);
      await refetchBalance();
    } catch {
      // tx state handled in hook
    }
  }

  async function handleDeposit() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Connect your MetaMask wallet on the Sepolia network.');
      return;
    }
    if (walletMismatch && onchainClientAddr) {
      setLocalError(
        `MetaMask wallet must be the on-chain client ${onchainClientAddr.slice(0, 6)}…${onchainClientAddr.slice(-4)} (same wallet that created the job).`,
      );
      return;
    }
    if (depositBlocked) {
      setLocalError(onchainBlocker);
      return;
    }
    if (insufficientUsdc) {
      setLocalError(
        `Insufficient MockUSDC balance (need ${totalDeposit} USDC). Mint testnet USDC on Sepolia first.`,
      );
      return;
    }
    if (!job.onchainJobId || !contractValue) {
      setLocalError('Job is missing on-chain id or contract value.');
      return;
    }

    const freelancerRaw = acceptedFreelancer ?? freelancerInput.trim();
    if (!isAddress(freelancerRaw) || freelancerRaw.toLowerCase() === zeroAddress) {
      setLocalError('Enter a valid freelancer wallet address (0x…, not 0x0).');
      return;
    }

    let freelancer: `0x${string}`;
    try {
      freelancer = getAddress(freelancerRaw);
    } catch {
      setLocalError('Invalid freelancer address.');
      return;
    }

    if (acceptedFreelancer && !addressesEqual(freelancer, acceptedFreelancer)) {
      setLocalError(
        `Freelancer must match the accepted bid: ${acceptedFreelancer}. Do not enter a different address.`,
      );
      return;
    }

    if (
      onchainFreelancerCs &&
      isNonZeroAddress(onchainFreelancerCs) &&
      !addressesEqual(freelancer, onchainFreelancerCs)
    ) {
      setLocalError(
        `Current on-chain freelancer is ${onchainFreelancerCs} — cannot deposit with ${freelancer}.`,
      );
      return;
    }

    setDepositing(true);
    try {
      await deposit({
        onchainJobId: job.onchainJobId,
        freelancerAddress: freelancer,
        expectedFreelancer: acceptedFreelancer ?? undefined,
        expectedOnchainClient: onchainClientAddr,
      });
      await refetchOnchain();
    } catch {
      // tx state handled in hook
    } finally {
      setDepositing(false);
    }
  }

  return (
    <section className="panel escrow-panel">
      <h3>Fund escrow (USDC)</h3>
      <p className="muted" title="Fund escrow on-chain">
        {user?.walletAddress && clientAddr && (
          <span className="phase-note">
            API session: <code className="mono">{shortAddress(user.walletAddress)}</code>
            {onchainClientAddr && (
              <>
                {' '}
                · Client on-chain (deposit):{' '}
                <code className="mono">{shortAddress(onchainClientAddr)}</code>
              </>
            )}
            <br />
          </span>
        )}
        <strong>Fund escrow:</strong> The client sends MockUSDC to the{' '}
        <code>EscrowVault</code> contract to lock funds for the freelancer. Total deposit = job price + 3%
        platform fee. This step includes <em>approve</em> USDC then <em>depositEscrow</em> — only the{' '}
        <strong>on-chain client</strong> wallet (job creator on JobRegistry) can call it.
        <code>depositEscrow</code> also <strong>assigns the on-chain freelancer</strong> — do not call{' '}
        <code>assignFreelancer</code> before this step.
      </p>

      {onchainStatus != null && (
        <p className="muted phase-note">
          On-chain job id: <strong>{job.onchainJobId}</strong> · JobRegistry:{' '}
          <strong>{onchainStatusLabel(onchainStatus)}</strong>
          {onchainFreelancerCs && (
            <>
              {' '}
              · freelancer:{' '}
              <code className="mono">{onchainFreelancerCs}</code>
            </>
          )}
        </p>
      )}

      {onChainValueMismatch && (
        <p className="error">
          On-chain price ({onchainContractValueUsdc} USDC) differs from DB ({contractValue} USDC). This job
          was created before the USDC unit fix — escrow will lock the actual on-chain amount (
          {onchainTotalDepositUsdc ?? '—'} USDC). Create a new job to demo the correct amount.
        </p>
      )}

      {depositComplete && (
        <p className="success escrow-success">
          <span className="badge success">Escrow funded</span>{' '}
          Deposit confirmed on-chain. Job is <strong>ASSIGNED</strong> with USDC locked in{' '}
          <code>EscrowVault</code> — freelancer can start work.
        </p>
      )}

      {registryMismatchMessage && (
        <p className="error">{registryMismatchMessage}</p>
      )}

      {depositBlocked && !depositComplete && !registryMismatchMessage && (
        <p className="error">{onchainBlocker}</p>
      )}

      {acceptedVsOnchainMismatch && acceptedFreelancer && onchainFreelancerCs && (
        <p className="error">
          On-chain freelancer ({onchainFreelancerCs}) differs from accepted bid ({acceptedFreelancer}).
          This job cannot be changed on-chain — the freelancer must use the on-chain wallet or create a new job.
        </p>
      )}

      {readyToDeposit && acceptedFreelancer && (
        <p className="muted phase-note">
          On-chain job is <strong>OPEN</strong> — ready to fund escrow for freelancer{' '}
          <code className="mono">{acceptedFreelancer}</code>.
        </p>
      )}

      {onchainStatus === ONCHAIN_JOB_STATUS.OPEN && !acceptedFreelancer && (
        <div className="escrow-mint-hint">
          <p className="muted">
            No freelancer address from an accepted bid yet. <strong>Do not</strong> use Retry assign —
            calling <code>assignFreelancer</code> moves the job to ASSIGNED and blocks{' '}
            <code>depositEscrow</code>. Enter the freelancer address and click Approve &amp; deposit.
          </p>
        </div>
      )}

      {onchainClientAddr && (
        <p className="muted phase-note">
          Client on-chain (API):{' '}
          <code>{shortAddress(onchainClientAddr)}</code>
          {onchainJob?.client && isNonZeroAddress(onchainJob.client) && (
            <>
              {' '}
              · JobRegistry read:{' '}
              <code>{shortAddress(onchainJob.client)}</code>
            </>
          )}
          {registryMismatch && (
            <span className="error"> — contract registry mismatch (see warning above).</span>
          )}
        </p>
      )}

      {walletMismatch && onchainClientAddr && address && !registryMismatch && (
        <div className="escrow-wallet-guide panel info" role="status">
          <h4>MetaMask wallet does not match on-chain client</h4>
          <p className="muted">
            <strong>Deposit escrow</strong> only succeeds when MetaMask is{' '}
            <code className="mono">{shortAddress(onchainClientAddr)}</code> (wallet that signed{' '}
            <code>createJob</code>). Current wallet: <code className="mono">{shortAddress(address)}</code>.
          </p>
          <p className="muted">
            Use the same wallet you signed in with SIWE when creating the job — no need to switch to a backend wallet.
          </p>
        </div>
      )}

      <dl className="detail-grid">
        <dt>Contract value</dt>
        <dd>{contractValue} USDC</dd>
        <dt>Total deposit</dt>
        <dd>{totalDeposit} USDC</dd>
        {acceptedFreelancer && (
          <>
            <dt>Freelancer (accepted)</dt>
            <dd className="mono">{acceptedFreelancer}</dd>
          </>
        )}
        {balanceUsdc != null && (
          <>
            <dt>Your MockUSDC balance</dt>
            <dd className={insufficientUsdc ? 'error' : undefined}>
              {balanceUsdc.toLocaleString()} USDC
              {insufficientUsdc && ' — insufficient; mint test tokens below'}
            </dd>
          </>
        )}
        <dt>MockUSDC contract</dt>
        <dd>
          <a
            href={etherscanAddressUrl(CONTRACT_ADDRESSES.MockUSDC)}
            target="_blank"
            rel="noreferrer"
          >
            <code>{CONTRACT_ADDRESSES.MockUSDC.slice(0, 6)}…{CONTRACT_ADDRESSES.MockUSDC.slice(-4)}</code>
          </a>
        </dd>
      </dl>

      {showMintSection && (
        <div className="escrow-mint-hint">
          <p className="muted">
            <strong>Sepolia ETH ≠ MockUSDC.</strong> Faucet ETH only pays gas. Fapex uses the{' '}
            <code>MockUSDC</code> token at the address above — not Circle USDC or other faucet tokens.
          </p>
          {walletMismatch && address && onchainClientAddr && (
            <p className="muted phase-note">
              Mint adds USDC to the connected wallet ({shortAddress(address)}). You need sufficient MockUSDC on the
              on-chain client wallet before depositing.
            </p>
          )}
          <button
            className="btn outline"
            type="button"
            onClick={handleMint}
            disabled={minting || mintTxStatus === 'pending' || !isConnected}
          >
            {minting || mintTxStatus === 'pending'
              ? 'Minting…'
              : `Mint ${DEMO_MINT_USDC.toLocaleString()} test USDC`}
          </button>
        </div>
      )}

      {!acceptedFreelancer && (
        <div className="field">
          <label htmlFor="freelancer-addr">Freelancer address</label>
          <input
            id="freelancer-addr"
            className="input full"
            value={freelancerInput}
            onChange={(e) => setFreelancerInput(e.target.value)}
            placeholder="0x… (from accepted proposal)"
          />
          <span className="muted phase-note">
            Auto-filled from the accepted proposal when available in the database.
          </span>
        </div>
      )}

      {localError && <p className="error">{localError}</p>}

      <button
        className="btn primary"
        type="button"
        onClick={handleDeposit}
        disabled={
          depositing ||
          txStatus === 'pending' ||
          walletMismatch ||
          insufficientUsdc ||
          depositBlocked ||
          registryMismatch ||
          acceptedVsOnchainMismatch ||
          depositComplete ||
          (!acceptedFreelancer && !freelancerInput.trim()) ||
          !isConnected
        }
        title={depositDisabledReason ?? undefined}
      >
        {depositComplete
          ? 'Escrow funded'
          : depositing || txStatus === 'pending'
            ? 'Processing…'
            : 'Approve & deposit escrow'}
      </button>

      {depositDisabledReason && !depositComplete && (
        <p className="muted phase-note deposit-blocked-reason">{depositDisabledReason}</p>
      )}

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />

      <TxStatusModal
        open={mintTxStatus !== 'idle'}
        status={mintTxStatus}
        label={`Minting ${DEMO_MINT_USDC} MockUSDC…`}
        hash={mintTxHash}
        error={mintTxError}
        onClose={() => {
          resetMintTx();
          void refetchBalance();
        }}
      />
    </section>
  );
}
