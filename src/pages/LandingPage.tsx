import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchJobs } from '@/lib/api';
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
    title: 'On-chain escrow',
    desc: 'USDC locked in EscrowVault — no custodian holds your funds.',
  },
  {
    title: 'Milestone release',
    desc: 'Client approves deliverables → USDC releases to the freelancer.',
  },
  {
    title: 'Transparent disputes',
    desc: 'IPFS evidence, staked arbitrators, and commit-reveal voting.',
  },
  {
    title: 'On-chain reputation',
    desc: 'ReputationStore soulbound scores — trust that stays with the wallet.',
  },
  {
    title: 'SIWE sign-in',
    desc: 'Sign-In with Ethereum — your wallet is your identity.',
  },
  {
    title: 'USDC stablecoin',
    desc: 'Job budgets and payouts in MockUSDC on Sepolia.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Post a job',
    desc: 'Clients publish work with IPFS metadata and a USDC budget on Sepolia.',
  },
  {
    step: '2',
    title: 'Fund escrow',
    desc: 'Accept a proposal and deposit USDC into the on-chain EscrowVault.',
  },
  {
    step: '3',
    title: 'Deliver work',
    desc: 'Freelancers submit deliverables; milestones track progress on-chain.',
  },
  {
    step: '4',
    title: 'Release or dispute',
    desc: 'Approve to release payment, or open a dispute with staked arbitrators.',
  },
];

const LANDING_TICKER = [
  { value: 'Sepolia', label: 'Live testnet' },
  { value: '3%', label: 'Platform fee' },
  { value: 'USDC', label: 'Stable settlement' },
  { value: '50 USDC', label: 'Min arbitrator stake' },
  { value: '5', label: 'Arbitrators per dispute' },
  { value: '0', label: 'Custodial risk' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [jobCount, setJobCount] = useState<number | null>(null);

  useEffect(() => {
    fetchJobs({ limit: 1 })
      .then((res) => {
        if (res.success) {
          setJobCount(res.pagination?.total ?? res.jobs?.length ?? 0);
        }
      })
      .catch(() => setJobCount(null));
  }, []);

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
          <div className="landing-hero-visual" aria-hidden>
            <div className="hero-orb hero-orb-a" />
            <div className="hero-orb hero-orb-b" />
            <div className="hero-grid-card">
              <span className="hero-grid-label">Escrow secured</span>
              <strong className="hero-grid-value">USDC · Sepolia</strong>
            </div>
          </div>

          <div className="landing-live-badge">
            <span className="dot-pulse" aria-hidden />
            Live on Sepolia testnet
          </div>

          <h1 className="landing-title font-display">
            Hire &amp; sell freelance services
            <span className="landing-title-accent text-gradient"> — with verifiable on-chain escrow</span>
          </h1>
          <p className="landing-subtitle">
            A Web3 freelance marketplace: post jobs, fund USDC escrow, deliver via IPFS, and resolve
            disputes with staked arbitrators. No opaque middleman custody.
          </p>

          <form className="landing-search" onSubmit={onSearch}>
            <input
              type="search"
              className="landing-search-input"
              placeholder="Search jobs: Solidity, design, audit…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search jobs"
            />
            <button type="submit" className="btn primary landing-search-btn">
              Search jobs
            </button>
          </form>

          <div className="landing-tags">
            <span className="landing-tags-label">Popular:</span>
            {POPULAR_TAGS.map((tag) => (
              <button key={tag} type="button" className="landing-tag" onClick={() => goTag(tag)}>
                {tag}
              </button>
            ))}
          </div>

          <div className="landing-ctas">
            <Link to="/client" className="btn primary landing-cta-hire">
              Hire a freelancer
            </Link>
            <Link to="/browse" className="btn outline landing-cta-sell">
              Find work
            </Link>
          </div>

          <dl className="landing-stats">
            <div>
              <dt>Network</dt>
              <dd>Sepolia</dd>
            </div>
            <div>
              <dt>Platform fee</dt>
              <dd>3%</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>USDC</dd>
            </div>
            <div>
              <dt>Oracle</dt>
              <dd>Chainlink</dd>
            </div>
          </dl>
        </div>
      </section>

      {jobCount != null && (
        <section className="landing-social-proof" aria-label="Platform activity">
          <p>
            <strong>{jobCount.toLocaleString()}</strong> jobs posted on FAPEX ·{' '}
            <strong>Sepolia testnet</strong> · escrow settled in USDC
          </p>
        </section>
      )}

      <div className="landing-ticker" aria-hidden>
        <div className="ticker-track">
          {[...LANDING_TICKER, ...LANDING_TICKER].map((item, i) => (
            <span key={`${item.label}-${i}`} className="ticker-item">
              <strong>{item.value}</strong>
              {item.label}
              <span style={{ opacity: 0.35 }}>|</span>
            </span>
          ))}
        </div>
      </div>

      <section className="landing-section">
        <h2>Why FAPEX?</h2>
        <p className="landing-section-lead">
          Instead of trusting a platform to hold funds, you trust auditable smart contracts on Sepolia.
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

      <section id="how-it-works" className="landing-section landing-steps">
        <h2>How it works</h2>
        <p className="landing-section-lead">
          From job post to payout — every critical step is enforced by smart contracts.
        </p>
        <div className="how-it-works-grid">
          {HOW_IT_WORKS.map((step) => (
            <article key={step.step} className="how-it-works-card">
              <span className="how-it-works-num">{step.step}</span>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-roles">
        <div className="landing-role-grid">
          {[
            { title: 'Client', desc: 'Post jobs, fund escrow, approve milestones.', to: '/client' },
            { title: 'Freelancer', desc: 'Browse jobs, bid, deliver on IPFS, get paid in USDC.', to: '/freelancer' },
            { title: 'Arbitrator', desc: 'Stake ≥50 USDC, join the pool, vote on disputes.', to: '/arbitrator' },
          ].map((r) => (
            <article key={r.title} className="landing-role-card">
              <h3>{r.title}</h3>
              <p>{r.desc}</p>
              <Link to={r.to} className={cn('btn ghost', 'landing-role-link')}>
                Open console →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-footer-cta">
        <h2>Get started on Sepolia</h2>
        <p>Connect MetaMask, sign in with SIWE, and choose Client or Freelancer.</p>
        <Link to="/profile" className="btn primary">
          Launch FAPEX
        </Link>
      </section>

      <footer className="landing-footer">
        <p className="muted">
          FAPEX — on-chain escrow on Sepolia.{' '}
          <Link to="/admin" className="etherscan-link">
            Governance
          </Link>{' '}
          (deployer / delegated roles)
        </p>
      </footer>
    </div>
  );
}
