import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';

const FEATURES = [
  {
    title: 'On-chain escrow',
    desc: 'Funds locked in EscrowVault until milestones are approved.',
  },
  {
    title: 'Milestone payments',
    desc: 'Split jobs into milestones with automatic fund release.',
  },
  {
    title: 'Transparent disputes',
    desc: 'Evidence on IPFS, arbitrators settle on-chain.',
  },
  {
    title: 'Soulbound reputation',
    desc: 'Non-transferable scores in ReputationStore.',
  },
  {
    title: 'Self-custody',
    desc: 'Sign in with your wallet using SIWE — no passwords.',
  },
  {
    title: 'Stablecoin payouts',
    desc: 'Contracts denominated in USDC on Sepolia testnet.',
  },
];

const STEPS = [
  { n: '01', title: 'Post & fund', desc: 'Client posts a job and deposits contract value plus fee into escrow.' },
  { n: '02', title: 'Hire talent', desc: 'Freelancers submit proposals; client accepts and assigns on-chain.' },
  { n: '03', title: 'Deliver & approve', desc: 'Freelancer uploads to IPFS and submits work; client approves release.' },
  { n: '04', title: 'Resolve fairly', desc: 'Disputes go to staked arbitrators with commit-reveal voting.' },
];

const STATS = [
  { v: 'Live', l: 'Sepolia testnet' },
  { v: '3%', l: 'Platform fee' },
  { v: 'USDC', l: 'Stable payouts' },
  { v: 'IPFS', l: 'Evidence storage' },
];

export function LandingPage() {
  return (
    <div className="landing-v0 -mx-6 -mt-2 sm:-mx-0">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-60" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              Live on Sepolia Testnet
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
              Freelance work, secured by smart contracts
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              FAPEX connects clients and freelancers through on-chain escrow, milestone-based
              payments, and transparent dispute resolution — no middlemen holding your funds.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/profile"
                className="inline-flex h-12 items-center justify-center rounded-lg bg-primary px-8 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Launch App →
              </Link>
              <Link
                to="/browse"
                className="inline-flex h-12 items-center justify-center rounded-lg border border-border bg-transparent px-8 text-base font-medium text-foreground transition-colors hover:bg-secondary"
              >
                Browse open jobs
              </Link>
            </div>
          </div>

          <dl className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l} className="text-center">
                <dt className="text-2xl font-bold text-foreground">{s.v}</dt>
                <dd className="mt-1 text-sm text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything happens on-chain
          </h2>
          <p className="mt-4 text-muted-foreground">
            Replace trust in a platform with trust in verifiable smart contracts on Sepolia.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              How FAPEX works
            </h2>
            <p className="mt-4 text-muted-foreground">From posting to payout in four trustless steps.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n}>
                <span className="font-mono text-3xl font-bold text-primary/30">{s.n}</span>
                <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Built for everyone in the loop
          </h2>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {[
            {
              title: 'For Clients',
              desc: 'Post jobs, fund escrow, review milestones, approve or dispute deliverables.',
              to: '/client',
              cta: 'Client dashboard',
            },
            {
              title: 'For Freelancers',
              desc: 'Browse jobs, submit proposals, deliver work, earn USDC on approval.',
              to: '/freelancer',
              cta: 'Freelancer dashboard',
            },
            {
              title: 'For Arbitrators',
              desc: 'Stake USDC, review disputes with evidence on IPFS, vote on-chain.',
              to: '/arbitrator',
              cta: 'Arbitrator console',
            },
          ].map((r) => (
            <article key={r.title} className="flex flex-col rounded-xl border border-border bg-card p-6">
              <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
              <Link
                to={r.to}
                className={cn(
                  'mt-6 inline-flex h-10 w-full items-center justify-center rounded-lg border border-border',
                  'text-sm font-medium text-foreground transition-colors hover:bg-secondary',
                )}
              >
                {r.cta} →
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-primary px-6 py-12 text-center">
          <div className="absolute inset-0 grid-pattern opacity-20" aria-hidden />
          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Start working trustlessly today
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/80">
              Connect your wallet, pick a role, and experience freelance work where the smart
              contract is the escrow agent.
            </p>
            <Link
              to="/profile"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-lg bg-secondary px-8 text-base font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Launch FAPEX
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
