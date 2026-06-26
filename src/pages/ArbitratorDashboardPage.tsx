import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchDisputes, fetchJobs } from '@/lib/api';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import { isAssignedArbitrator, readChosenArbitrators } from '@/hooks/useDisputeActions';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';

type AssignedDispute = {
  onchainJobId: number;
  jobId?: string;
  title?: string;
  disputeStatus?: string;
};

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const stake = useArbitratorAccess();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignedDisputes, setAssignedDisputes] = useState<AssignedDispute[]>([]);

  const loadAssignedDisputes = useCallback(async () => {
    if (!address) {
      setAssignedDisputes([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [jobsRes, disputesRes] = await Promise.all([
        fetchJobs({ status: 'DISPUTED', limit: 30 }),
        fetchDisputes({ status: 'OPEN', limit: 30 }),
      ]);

      const candidates = new Map<number, AssignedDispute>();

      for (const job of jobsRes.jobs ?? []) {
        if (isValidOnchainJobId(job.onchainJobId)) {
          candidates.set(job.onchainJobId!, {
            onchainJobId: job.onchainJobId!,
            jobId: job._id,
            title: job.title,
            disputeStatus: job.status,
          });
        }
      }

      for (const d of disputesRes.disputes ?? []) {
        if (!isValidOnchainJobId(d.onchainJobId)) continue;
        const existing = candidates.get(d.onchainJobId);
        candidates.set(d.onchainJobId, {
          onchainJobId: d.onchainJobId,
          jobId: d.jobId ?? existing?.jobId,
          title: existing?.title,
          disputeStatus: d.status ?? existing?.disputeStatus,
        });
      }

      const filtered: AssignedDispute[] = [];
      await Promise.all(
        [...candidates.values()].map(async (item) => {
          try {
            const arbs = await readChosenArbitrators(item.onchainJobId);
            if (isAssignedArbitrator(arbs, address)) {
              filtered.push(item);
            }
          } catch {
            /* skip unreadable */
          }
        }),
      );

      filtered.sort((a, b) => b.onchainJobId - a.onchainJobId);
      setAssignedDisputes(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách tranh chấp');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (stake.error) setError(stake.error);
  }, [stake.error]);

  useEffect(() => {
    void loadAssignedDisputes();
  }, [loadAssignedDisputes]);

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
      {error && <p className="error">{error}</p>}

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
            onClick={() => void loadAssignedDisputes()}
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
          <p className="muted">
            Chưa có job DISPUTED nào chọn ví của bạn. Import private key từ{' '}
            <code>deployments/sepolia-arbitrators.json</code> (chạy{' '}
            <code>seed-arbitrator-pool.js</code> trước).
          </p>
        )}

        {assignedDisputes.length > 0 && (
          <ul className="bids-list">
            {assignedDisputes.map((d) => (
              <li key={d.onchainJobId} className="bid-item">
                <strong>
                  Job on-chain #{d.onchainJobId}
                  {d.title ? ` — ${d.title}` : ''}
                </strong>
                <span className="muted"> · {d.disputeStatus ?? 'DISPUTED'}</span>
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
