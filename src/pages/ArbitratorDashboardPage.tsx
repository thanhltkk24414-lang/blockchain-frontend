import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import {
  shortWallet,
  useArbitratorDisputes,
  type ArbitratorDisputeItem,
} from '@/hooks/useArbitratorDisputes';
import { isAssignedArbitrator } from '@/hooks/useDisputeActions';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';

function DisputeList({
  items,
  note,
}: {
  items: ArbitratorDisputeItem[];
  note?: string;
}) {
  if (items.length === 0) return null;

  return (
    <>
      {note && <p className="muted phase-note">{note}</p>}
      <ul className="bids-list">
        {items.map((d) => (
          <li key={d.onchainJobId} className="bid-item">
            <strong>
              Job on-chain #{d.onchainJobId}
              {d.title ? ` — ${d.title}` : ''}
            </strong>
            <span className="muted"> · {d.disputeStatus}</span>
            {d.jobId ? (
              <Link to={`/jobs/${d.jobId}`} className="btn primary">
                Mở chi tiết & vote →
              </Link>
            ) : (
              <span className="muted">Chưa sync jobId off-chain</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const stake = useArbitratorAccess();
  const {
    assignedDisputes,
    poolOnlyDisputes,
    samplePanelWallets,
    loading,
    error,
    reload,
  } = useArbitratorDisputes(address, stake.inPool);

  const displayError = error ?? stake.error;

  const hintArbitratorWallet =
    samplePanelWallets.find((w) => !isAssignedArbitrator([w], address)) ??
    samplePanelWallets[0] ??
    '0x59a1E706254fcE3152feeE8D95Ecf74f1f30040e';

  return (
    <main className="page">
      <div className="page-header">
        <h2>Bảng điều khiển Arbitrator</h2>
        <p className="muted">
          Cần ≥ 50 USDC stake trên PlatformTreasury. Khi được sortition chọn vào hội đồng, vote
          commit-reveal trên trang chi tiết job.
        </p>
      </div>

      {!isAuthenticated && (
        <p className="muted">Kết nối ví MetaMask và đăng nhập SIWE để xem tranh chấp được giao.</p>
      )}

      {stake.loading && <p className="muted">Đang kiểm tra stake…</p>}
      {displayError && <p className="error">{displayError}</p>}

      {stake.stakedAmount != null && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">USDC đã stake</span>
            <strong>{stake.stakedAmount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Stake tối thiểu</span>
            <strong>{stake.minStake ?? 50}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Đủ điều kiện pool</span>
            <strong>{stake.isValid ? 'Có' : 'Chưa'}</strong>
          </div>
        </div>
      )}

      {stake.message && <p className="muted phase-note">{stake.message}</p>}

      <section className="panel">
        <div className="panel-header-row">
          <h3>Tranh chấp được giao cho bạn</h3>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void reload()}
            disabled={loading}
          >
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        <p className="muted phase-note">
          Demo Sepolia: bằng chứng 0–{DISPUTE_PHASES.evidenceRebuttalEndMin}p → commit{' '}
          {DISPUTE_PHASES.commitStartMin}–{DISPUTE_PHASES.commitEndMin}p → reveal{' '}
          {DISPUTE_PHASES.revealStartMin}–{DISPUTE_PHASES.revealEndMin}p → finalize sau{' '}
          {DISPUTE_PHASES.revealEndMin}p → kháng cáo {DISPUTE_PHASES.appealWindowHours}h.
        </p>

        {!address && <p className="muted">Chưa kết nối ví.</p>}

        {address && !loading && assignedDisputes.length === 0 && (
          <div className="muted phase-note">
            <p>
              Đang dùng ví <code>{shortWallet(address)}</code>
              {stake.inPool ? ' (trong pool arbitrator)' : ''} —{' '}
              {samplePanelWallets.length > 0
                ? 'không nằm hội đồng các job đang tranh chấp.'
                : 'chưa có job DISPUTED on-chain nào trong phạm vi quét.'}
            </p>
            {samplePanelWallets.length > 0 && (
              <p>
                Chuyển sang ví arbitrator được chọn (vd.{' '}
                <code>{shortWallet(hintArbitratorWallet)}</code>) — import private key từ{' '}
                <code>deployments/sepolia-arbitrators.json</code>.
              </p>
            )}
            {samplePanelWallets.length === 0 && (
              <p>
                Chạy <code>seed-arbitrator-pool.js</code> và mở tranh chấp trên job SUBMITTED trước.
              </p>
            )}
          </div>
        )}

        <DisputeList items={assignedDisputes} />

        {poolOnlyDisputes.length > 0 && (
          <>
            <h4>Tranh chấp khác (trong pool, chưa được chọn)</h4>
            <DisputeList
              items={poolOnlyDisputes}
              note="Bạn trong pool arbitrator nhưng sortition không chọn ví này cho hội đồng job này — chỉ xem, không vote."
            />
          </>
        )}
      </section>

      <section className="panel">
        <h3>Hướng dẫn test nhanh</h3>
        <ol className="muted phase-note">
          <li>
            Import 1 ví từ <code>deployments/sepolia-arbitrators.json</code> vào MetaMask (Sepolia).
          </li>
          <li>Stake ≥50 USDC + admin <code>joinPool</code> (script seed đã làm sẵn).</li>
          <li>Client raise dispute trên job → 5 arbitrator được chọn ngẫu nhiên.</li>
          <li>Vào job DISPUTED → panel &quot;Hội đồng arbitrator&quot; → commit / reveal theo đồng hồ.</li>
        </ol>
        <p className="muted">
          Stake thêm tại <Link to="/profile">Profile</Link>.
        </p>
      </section>
    </main>
  );
}
