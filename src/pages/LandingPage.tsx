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
            Hire &amp; sell freelance services
            <span className="landing-title-accent"> — with verifiable on-chain escrow</span>
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
              Hire a freelancer →
            </Link>
            <Link to="/browse" className="btn ghost landing-cta-sell">
              Find work / Browse jobs
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

      <section className="landing-section landing-steps">
        <h2>How it works</h2>
        <ol className="landing-step-list">
          <li>
            <strong>Post &amp; fund</strong> — Client creates a job with IPFS metadata and deposits USDC
            escrow.
          </li>
          <li>
            <strong>Hire</strong> — Freelancers bid; the client accepts and assigns on-chain.
          </li>
          <li>
            <strong>Deliver &amp; approve</strong> — Deliverable CID on-chain; client approves release.
          </li>
          <li>
            <strong>Dispute (if needed)</strong> — IPFS evidence + arbitrator commit-reveal voting.
          </li>
        </ol>
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
    </div>
  );
}
