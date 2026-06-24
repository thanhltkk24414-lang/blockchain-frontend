import { Coins, FileLock2, Gavel, Layers, Star, Wallet } from "lucide-react"
import { Card } from "@/components/ui/card"

const FEATURES = [
  {
    icon: FileLock2,
    title: "On-chain escrow",
    desc: "Client funds are locked in an EscrowVault contract the moment a job is assigned. Neither party can touch them until milestones are approved.",
  },
  {
    icon: Layers,
    title: "Milestone payments",
    desc: "Split any job into up to 10 milestones. Funds release automatically as each deliverable is reviewed and approved.",
  },
  {
    icon: Gavel,
    title: "Transparent disputes",
    desc: "Raise a dispute, upload evidence to IPFS, and let neutral arbitrators settle it with an on-chain split decision.",
  },
  {
    icon: Star,
    title: "Soulbound reputation",
    desc: "Every completed job updates a non-transferable reputation score stored on-chain in ReputationStore.",
  },
  {
    icon: Wallet,
    title: "Self-custody",
    desc: "Sign in with your wallet using SIWE. No passwords, no custody of your keys, no platform holding your money.",
  },
  {
    icon: Coins,
    title: "Stablecoin payouts",
    desc: "Contracts are denominated in USDC so freelancers know exactly what they will earn — no volatility surprises.",
  },
]

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Everything happens on-chain
        </h2>
        <p className="mt-4 text-pretty text-muted-foreground">
          FAPEX replaces trust in a platform with trust in verifiable smart contracts deployed on Sepolia.
        </p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-6 transition-colors hover:border-primary/40">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>
  )
}
