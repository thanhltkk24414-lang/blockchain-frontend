import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { isAddress, zeroAddress } from 'viem';
import type { Bid, Job } from '@/lib/api';
import { retryAssignFreelancer } from '@/lib/api';
import { useEscrowDeposit } from '@/hooks/useEscrowDeposit';
import { DEMO_MINT_USDC, useMockUsdcMint } from '@/hooks/useMockUsdcMint';
import { useUsdcBalance } from '@/hooks/contracts/useContracts';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { etherscanAddressUrl, isValidOnchainJobId } from '@/lib/utils/etherscan';
import {
  explainDepositBlocker,
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

function resolveAcceptedFreelancer(job: Job, bids: Bid[]): string | null {
  const fromJob = resolveFreelancerFromJob(job);
  if (fromJob) return fromJob;

  const accepted = bids.find((b) => b.status === 'accepted');
  if (accepted && isNonZeroAddress(accepted.freelancerAddress)) {
    return accepted.freelancerAddress;
  }

  return null;
}

export function EscrowDepositPanel({ job, bids = [] }: EscrowDepositPanelProps) {
  const { address, isConnected } = useAccount();
  const clientAddr = resolveClientAddress(job);
  const onchainClientAddr = resolveOnchainClientAddress(job);
  const isSiweClient = Boolean(
    address && clientAddr && address.toLowerCase() === clientAddr,
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
  const [retryingAssign, setRetryingAssign] = useState(false);
  const [onchainStatus, setOnchainStatus] = useState<number | null>(null);
  const [onchainFreelancer, setOnchainFreelancer] = useState<string | null>(null);
  const [onchainBlocker, setOnchainBlocker] = useState<string | null>(null);

  const { deposit, readOnChainJob, txStatus, txHash, txLabel, txError, resetTx, totalDepositUsdc } =
    useEscrowDeposit();
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
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    let cancelled = false;
    void readOnChainJob(job.onchainJobId!)
      .then((onChainJob) => {
        if (cancelled) return;
        setOnchainStatus(onChainJob.status);
        setOnchainFreelancer(
          isNonZeroAddress(onChainJob.freelancer) ? onChainJob.freelancer : null,
        );
        setOnchainBlocker(explainDepositBlocker(onChainJob));
        if (!acceptedFreelancer && isNonZeroAddress(onChainJob.freelancer)) {
          setFreelancerInput(onChainJob.freelancer);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [acceptedFreelancer, job.onchainJobId, readOnChainJob]);

  useEffect(() => {
    if (acceptedFreelancer) {
      setFreelancerInput(acceptedFreelancer);
    }
  }, [acceptedFreelancer]);

  if (!isValidOnchainJobId(job.onchainJobId) || !isSiweClient) {
    return null;
  }

  const contractValue = job.contractValue ?? 0;
  const totalDeposit = job.totalDeposit ?? totalDepositUsdc(contractValue);
  const balanceUsdc =
    balance != null ? Number(balance) / 1_000_000 : null;
  const insufficientUsdc =
    balanceUsdc != null && balanceUsdc < totalDeposit;
  const depositBlocked = Boolean(onchainBlocker);
  const readyToDeposit =
    onchainStatus === ONCHAIN_JOB_STATUS.OPEN && !depositBlocked;

  async function handleMint() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Kết nối ví MetaMask trên mạng Sepolia.');
      return;
    }
    try {
      await mint(DEMO_MINT_USDC);
      await refetchBalance();
    } catch {
      // tx state handled in hook
    }
  }

  async function handleRetryAssign() {
    setLocalError(null);
    const freelancer = acceptedFreelancer ?? freelancerInput.trim();
    if (!isAddress(freelancer) || freelancer.toLowerCase() === zeroAddress) {
      setLocalError('Cần địa chỉ freelancer hợp lệ để retry assign.');
      return;
    }
    setRetryingAssign(true);
    try {
      const res = await retryAssignFreelancer(job._id, freelancer);
      if (!res.success) {
        throw new Error(res.error || 'Retry assign failed');
      }
      if (job.onchainJobId) {
        const onChainJob = await readOnChainJob(job.onchainJobId);
        setOnchainStatus(onChainJob.status);
        setOnchainFreelancer(
          isNonZeroAddress(onChainJob.freelancer) ? onChainJob.freelancer : null,
        );
        setOnchainBlocker(explainDepositBlocker(onChainJob));
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Retry assign failed');
    } finally {
      setRetryingAssign(false);
    }
  }

  async function handleDeposit() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Kết nối ví MetaMask trên mạng Sepolia.');
      return;
    }
    if (walletMismatch && onchainClientAddr) {
      setLocalError(
        `Ví đang kết nối không phải client on-chain. Hãy chuyển sang ${onchainClientAddr.slice(0, 6)}…${onchainClientAddr.slice(-4)} (ví backend tạo job).`,
      );
      return;
    }
    if (depositBlocked) {
      setLocalError(onchainBlocker);
      return;
    }
    if (insufficientUsdc) {
      setLocalError(
        `Số dư MockUSDC không đủ (cần ${totalDeposit} USDC). Mint testnet USDC trên Sepolia trước.`,
      );
      return;
    }
    if (!job.onchainJobId || !contractValue) {
      setLocalError('Job thiếu on-chain id hoặc giá trị hợp đồng.');
      return;
    }
    const freelancer = (acceptedFreelancer ?? freelancerInput).trim();
    if (!isAddress(freelancer) || freelancer.toLowerCase() === zeroAddress) {
      setLocalError('Nhập địa chỉ ví freelancer hợp lệ (0x…, không phải 0x0).');
      return;
    }

    setDepositing(true);
    try {
      await deposit({
        onchainJobId: job.onchainJobId,
        freelancerAddress: freelancer as `0x${string}`,
        contractValue,
      });
      if (job.onchainJobId) {
        const onChainJob = await readOnChainJob(job.onchainJobId);
        setOnchainStatus(onChainJob.status);
        setOnchainBlocker(explainDepositBlocker(onChainJob));
      }
    } catch {
      // tx state handled in hook
    } finally {
      setDepositing(false);
    }
  }

  return (
    <section className="panel escrow-panel">
      <h3>Fund escrow (USDC)</h3>
      <p className="muted" title="Nạp tiền ký quỹ on-chain">
        <strong>Nạp ký quỹ (Fund escrow):</strong> Client gửi MockUSDC vào hợp đồng{' '}
        <code>EscrowVault</code> để khóa tiền cho freelancer. Tổng nạp = giá job + 3% phí
        nền tảng. Bước này gồm <em>approve</em> USDC rồi <em>depositEscrow</em> — chỉ ví{' '}
        <strong>client on-chain</strong> (người tạo job trên JobRegistry) mới gọi được.
        <code>depositEscrow</code> cũng <strong>gán freelancer on-chain</strong> — không gọi{' '}
        <code>assignFreelancer</code> trước bước này.
      </p>

      {onchainStatus != null && (
        <p className="muted phase-note">
          Trạng thái on-chain JobRegistry: <strong>{onchainStatusLabel(onchainStatus)}</strong>
          {onchainFreelancer && (
            <>
              {' '}
              · freelancer:{' '}
              <code>
                {onchainFreelancer.slice(0, 6)}…{onchainFreelancer.slice(-4)}
              </code>
            </>
          )}
        </p>
      )}

      {depositBlocked && (
        <p className="error">{onchainBlocker}</p>
      )}

      {readyToDeposit && acceptedFreelancer && (
        <p className="muted phase-note">
          Job on-chain đang <strong>OPEN</strong> — sẵn sàng nạp escrow cho freelancer{' '}
          <code>{acceptedFreelancer.slice(0, 6)}…{acceptedFreelancer.slice(-4)}</code>.
        </p>
      )}

      {onchainStatus === ONCHAIN_JOB_STATUS.OPEN && !acceptedFreelancer && (
        <div className="escrow-mint-hint">
          <p className="muted">
            Chưa có địa chỉ freelancer từ bid đã accept. Nếu assign relay thất bại trước đây, có
            thể thử lại (chỉ khi job vẫn OPEN):
          </p>
          <button
            className="btn outline"
            type="button"
            onClick={handleRetryAssign}
            disabled={retryingAssign}
          >
            {retryingAssign ? 'Retrying…' : 'Retry assign on-chain'}
          </button>
        </div>
      )}

      {onchainClientAddr && (
        <p className="muted phase-note">
          Client on-chain:{' '}
          <code>
            {onchainClientAddr.slice(0, 6)}…{onchainClientAddr.slice(-4)}
          </code>
          {walletMismatch && (
            <span className="error">
              {' '}
              — ví MetaMask hiện tại khác ví này; giao dịch sẽ revert.
            </span>
          )}
        </p>
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
              {insufficientUsdc && ' — chưa đủ; mint token test bên dưới'}
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

      {insufficientUsdc && (
        <div className="escrow-mint-hint">
          <p className="muted">
            <strong>Sepolia ETH ≠ MockUSDC.</strong> ETH từ faucet chỉ trả phí gas. Fapex dùng token{' '}
            <code>MockUSDC</code> tại địa chỉ trên — không phải USDC Circle hay token faucet khác.
          </p>
          <button
            className="btn outline"
            type="button"
            onClick={handleMint}
            disabled={minting || mintTxStatus === 'pending' || walletMismatch || !isConnected}
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
            placeholder="0x… (từ proposal đã chấp nhận)"
          />
          <span className="muted phase-note">
            Tự điền từ proposal đã accept khi có trong DB.
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
          depositBlocked
        }
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
