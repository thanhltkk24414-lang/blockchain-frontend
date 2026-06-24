import Link from "next/link"
import { Logo } from "@/components/common/logo"
import { CONTRACTS } from "@/lib/contracts"
import { shortenAddress } from "@/lib/utils"

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "Browse Jobs", href: "/freelancer/browse" },
      { label: "Post a Job", href: "/client/jobs/create" },
      { label: "Client Dashboard", href: "/client/dashboard" },
      { label: "Freelancer Dashboard", href: "/freelancer/dashboard" },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "How it works", href: "/#how" },
      { label: "Dispute resolution", href: "/#features" },
      { label: "Admin console", href: "/admin/dashboard" },
      { label: "Sepolia Testnet", href: "https://sepolia.etherscan.io" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            FAPEX is a decentralized freelance marketplace. Smart contracts handle escrow, milestone payments and
            dispute resolution — transparently, on-chain.
          </p>
          <div className="mt-4 space-y-1">
            <p className="text-xs text-muted-foreground">JobRegistry</p>
            <p className="font-mono text-xs text-foreground">{shortenAddress(CONTRACTS.JobRegistry, 8)}</p>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>{"© "}{new Date().getFullYear()} FAPEX Protocol. Built on Ethereum.</p>
          <p>Running on Sepolia Testnet</p>
        </div>
      </div>
    </footer>
  )
}
