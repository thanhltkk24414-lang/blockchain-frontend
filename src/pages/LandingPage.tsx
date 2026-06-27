import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FapexLogo } from '@/components/shared/FapexLogo';
import { useEthUsdPrice } from '@/hooks/useEthUsdPrice';
import { cn } from '@/lib/utils/cn';

const POPULAR_TAGS = [
  'Solidity',
  'Smart Contract',
  'Web3',
  'React',
  'UI/UX',
  'DeFi',
  'NFT',
  'Rust',
  'Audit',
  'Tokenomics',
];

const FEATURES = [
  {
    title: 'Escrow on-chain',
    desc: 'USDC khóa trong EscrowVault — không ai giữ tiền hộ bạn.',
  },
  {
    title: 'Milestone & release',
    desc: 'Client phê duyệt → tự động giải ngân cho freelancer.',
  },
  {
    title: 'Tranh chấp minh bạch',
    desc: 'Bằng chứng IPFS, arbitrator stake + commit-reveal.',
  },
  {
    title: 'Reputation on-chain',
    desc: 'ReputationStore soulbound — điểm uy tín không chuyển nhượng.',
  },
  {
    title: 'SIWE đăng nhập',
    desc: 'Sign-In with Ethereum — không mật khẩu, ví là danh tính.',
  },
  {
    title: 'Stablecoin USDC',
    desc: 'Giá job và thanh toán bằng MockUSDC trên Sepolia.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { price, loading: priceLoading } = useEthUsdPrice();

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/browse?search=${encodeURIComponent(q)}` : '/browse');
  };

  const goTag = (tag: string) => {
    navigate(`/browse?search=${encodeURIComponent(tag)}`);
  };

  return (
    <div className="landing-hyve">
      <section className="landing-hero">
        <div className="landing-hero-glow" aria-hidden />
        <div className="landing-hero-inner">
          <div className="landing-hero-top">
            <FapexLogo size="lg" />
            {price && !priceLoading && (
              <span className="landing-eth-price" title="Chainlink ETH/USD Sepolia">
                ETH ${price.usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            )}
          </div>

          <h1 className="landing-title">
            Thuê &amp; bán dịch vụ crypto
            <span className="landing-title-accent"> — escrow minh bạch on-chain</span>
          </h1>
          <p className="landing-subtitle">
            Nền tảng freelance Web3: đăng job, ký quỹ USDC, giao hàng IPFS, tranh chấp bởi
            arbitrator có stake. Không middleman giữ tiền.
          </p>

          <form className="landing-search" onSubmit={onSearch}>
            <input
              type="search"
              className="landing-search-input"
              placeholder="Tìm job: Solidity, design, audit…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm kiếm job"
            />
            <button type="submit" className="btn primary landing-search-btn">
              Tìm job
            </button>
          </form>

          <div className="landing-tags">
            <span className="landing-tags-label">Phổ biến:</span>
            {POPULAR_TAGS.map((tag) => (
              <button key={tag} type="button" className="landing-tag" onClick={() => goTag(tag)}>
                {tag}
              </button>
            ))}
          </div>

          <div className="landing-ctas">
            <Link to="/client" className="btn primary landing-cta-hire">
              Thuê freelancer →
            </Link>
            <Link to="/browse" className="btn ghost landing-cta-sell">
              Bán dịch vụ / Nhận job
            </Link>
          </div>

          <dl className="landing-stats">
            <div>
              <dt>Live</dt>
              <dd>Sepolia</dd>
            </div>
            <div>
              <dt>Phí</dt>
              <dd>3%</dd>
            </div>
            <div>
              <dt>Thanh toán</dt>
              <dd>USDC</dd>
            </div>
            <div>
              <dt>Oracle</dt>
              <dd>Chainlink</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="landing-section">
        <h2>Vì sao FAPEX?</h2>
        <p className="landing-section-lead">
          Thay vì tin platform giữ tiền, bạn tin smart contract có thể kiểm chứng trên Sepolia.
        </p>
        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature-card">
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-steps">
        <h2>Luồng 4 bước</h2>
        <ol className="landing-step-list">
          <li>
            <strong>Đăng &amp; fund</strong> — Client tạo job + metadata IPFS, nạp escrow USDC.
          </li>
          <li>
            <strong>Thuê</strong> — Freelancer bid; client accept và gán on-chain.
          </li>
          <li>
            <strong>Giao &amp; duyệt</strong> — Deliverable CID on-chain; client approve release.
          </li>
          <li>
            <strong>Tranh chấp</strong> — Nếu cần: evidence IPFS + arbitrator vote commit-reveal.
          </li>
        </ol>
      </section>

      <section className="landing-section landing-roles">
        <div className="landing-role-grid">
          {[
            { title: 'Client', desc: 'Đăng job, nạp escrow, duyệt milestone.', to: '/client' },
            { title: 'Freelancer', desc: 'Browse, bid, deliver IPFS, nhận USDC.', to: '/freelancer' },
            { title: 'Arbitrator', desc: 'Stake ≥50 USDC, vote tranh chấp.', to: '/arbitrator' },
          ].map((r) => (
            <article key={r.title} className="landing-role-card">
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
              <Link to={r.to} className={cn('btn ghost', 'landing-role-link')}>
                Vào console →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-footer-cta">
        <h2>Bắt đầu trên Sepolia</h2>
        <p>Kết nối MetaMask, đăng nhập SIWE, chọn vai trò Client hoặc Freelancer.</p>
        <Link to="/profile" className="btn primary">
          Launch FAPEX
        </Link>
      </section>
    </div>
  );
}
