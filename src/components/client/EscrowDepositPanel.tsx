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
    if (depositComplete) return 'Escrow đã được nạp on-chain.';
    if (walletMismatch && onchainClientAddr) {
      return `Chuyển MetaMask sang ${shortAddress(onchainClientAddr)} (ví đã tạo job on-chain) để approve & deposit.`;
    }
    if (registryMismatch && registryMismatchMessage) return registryMismatchMessage;
    if (depositBlocked && onchainBlocker) return onchainBlocker;
    if (acceptedVsOnchainMismatch) {
      return 'Freelancer on-chain không khớp bid đã accept.';
    }
    if (insufficientUsdc) {
      return `Cần ${totalDeposit} MockUSDC trên ví client on-chain — mint bên dưới sau khi chuyển đúng ví.`;
    }
    if (!acceptedFreelancer && !freelancerInput.trim()) {
      return 'Nhập địa chỉ freelancer từ proposal đã accept.';
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

  async function handleDeposit() {
    setLocalError(null);
    if (!isConnected || !address) {
      setLocalError('Kết nối ví MetaMask trên mạng Sepolia.');
      return;
    }
    if (walletMismatch && onchainClientAddr) {
      setLocalError(
        `Ví MetaMask phải là client on-chain ${onchainClientAddr.slice(0, 6)}…${onchainClientAddr.slice(-4)} (cùng ví đã tạo job).`,
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

    const freelancerRaw = acceptedFreelancer ?? freelancerInput.trim();
    if (!isAddress(freelancerRaw) || freelancerRaw.toLowerCase() === zeroAddress) {
      setLocalError('Nhập địa chỉ ví freelancer hợp lệ (0x…, không phải 0x0).');
      return;
    }

    let freelancer: `0x${string}`;
    try {
      freelancer = getAddress(freelancerRaw);
    } catch {
      setLocalError('Địa chỉ freelancer không hợp lệ.');
      return;
    }

    if (acceptedFreelancer && !addressesEqual(freelancer, acceptedFreelancer)) {
      setLocalError(
        `Freelancer phải trùng bid đã accept: ${acceptedFreelancer}. Không được nhập địa chỉ khác.`,
      );
      return;
    }

    if (
      onchainFreelancerCs &&
      isNonZeroAddress(onchainFreelancerCs) &&
      !addressesEqual(freelancer, onchainFreelancerCs)
    ) {
      setLocalError(
        `Freelancer on-chain hiện tại là ${onchainFreelancerCs} — không thể deposit với ${freelancer}.`,
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
      <p className="muted" title="Nạp tiền ký quỹ on-chain">
        {user?.walletAddress && clientAddr && (
          <span className="phase-note">
            Đăng nhập API: <code className="mono">{shortAddress(user.walletAddress)}</code>
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
        <strong>Nạp ký quỹ (Fund escrow):</strong> Client gửi MockUSDC vào hợp đồng{' '}
        <code>EscrowVault</code> để khóa tiền cho freelancer. Tổng nạp = giá job + 3% phí
        nền tảng. Bước này gồm <em>approve</em> USDC rồi <em>depositEscrow</em> — chỉ ví{' '}
        <strong>client on-chain</strong> (người tạo job trên JobRegistry) mới gọi được.
        <code>depositEscrow</code> cũng <strong>gán freelancer on-chain</strong> — không gọi{' '}
        <code>assignFreelancer</code> trước bước này.
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
          Giá on-chain ({onchainContractValueUsdc} USDC) khác DB ({contractValue} USDC). Job này
          được tạo trước khi sửa đơn vị USDC — escrow sẽ khóa số tiền on-chain thực tế (
          {onchainTotalDepositUsdc ?? '—'} USDC). Tạo job mới để demo đúng số tiền.
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
          Freelancer on-chain ({onchainFreelancerCs}) khác bid đã accept ({acceptedFreelancer}).
          Job này không sửa được on-chain — freelancer phải dùng ví on-chain hoặc tạo job mới.
        </p>
      )}

      {readyToDeposit && acceptedFreelancer && (
        <p className="muted phase-note">
          Job on-chain đang <strong>OPEN</strong> — sẵn sàng nạp escrow cho freelancer{' '}
          <code className="mono">{acceptedFreelancer}</code>.
        </p>
      )}

      {onchainStatus === ONCHAIN_JOB_STATUS.OPEN && !acceptedFreelancer && (
        <div className="escrow-mint-hint">
          <p className="muted">
            Chưa có địa chỉ freelancer từ bid đã accept. <strong>Không</strong> dùng Retry assign —
            gọi <code>assignFreelancer</code> sẽ chuyển job sang ASSIGNED và chặn{' '}
            <code>depositEscrow</code>. Nhập địa chỉ freelancer và bấm Approve &amp; deposit.
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
            <span className="error"> — lệch contract registry (xem cảnh báo trên).</span>
          )}
        </p>
      )}

      {walletMismatch && onchainClientAddr && address && !registryMismatch && (
        <div className="escrow-wallet-guide panel info" role="status">
          <h4>Ví MetaMask không khớp client on-chain</h4>
          <p className="muted">
            <strong>Deposit escrow</strong> chỉ thành công khi MetaMask là{' '}
            <code className="mono">{shortAddress(onchainClientAddr)}</code> (ví đã ký{' '}
            <code>createJob</code>). Ví hiện tại: <code className="mono">{shortAddress(address)}</code>.
          </p>
          <p className="muted">
            Dùng cùng ví đăng nhập SIWE khi tạo job — không cần chuyển sang ví backend.
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

      {showMintSection && (
        <div className="escrow-mint-hint">
          <p className="muted">
            <strong>Sepolia ETH ≠ MockUSDC.</strong> ETH từ faucet chỉ trả phí gas. Fapex dùng token{' '}
            <code>MockUSDC</code> tại địa chỉ trên — không phải USDC Circle hay token faucet khác.
          </p>
          {walletMismatch && address && onchainClientAddr && (
            <p className="muted phase-note">
              Mint sẽ cộng USDC vào ví đang kết nối ({shortAddress(address)}). Cần đủ MockUSDC trên ví
              client on-chain trước khi deposit.
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
