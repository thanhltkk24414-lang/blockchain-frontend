"use client"

import { useState } from "react"
import { Copy, LogOut, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { useWallet } from "@/components/providers/wallet-provider"
import { etherscanAddress, formatETH, formatUSDC, shortenAddress } from "@/lib/utils"

export function ConnectWallet() {
  const { connected, connecting, address, ethBalance, usdcBalance, connect, disconnect } = useWallet()
  const [open, setOpen] = useState(false)

  if (!connected) {
    return (
      <Button onClick={connect} disabled={connecting} className="gap-2">
        <Wallet className="size-4" />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
      >
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{formatETH(ethBalance)} ETH</span>
        <span className="size-2 rounded-full bg-success" aria-hidden />
        <span className="font-mono text-foreground">{shortenAddress(address)}</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Wallet" className="max-w-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 p-3">
            <span className="font-mono text-sm text-foreground">{shortenAddress(address, 6)}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  navigator.clipboard.writeText(address)
                  toast.success("Address copied")
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">ETH Balance</p>
              <p className="mt-1 font-semibold text-foreground">{formatETH(ethBalance)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">USDC Balance</p>
              <p className="mt-1 font-semibold text-foreground">{formatUSDC(usdcBalance)}</p>
            </div>
          </div>
          <a
            href={etherscanAddress(address)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs text-primary hover:underline"
          >
            View on Etherscan
          </a>
          <Button
            variant="outline"
            onClick={() => {
              disconnect()
              setOpen(false)
              toast.success("Wallet disconnected")
            }}
            className="gap-2"
          >
            <LogOut className="size-4" />
            Disconnect
          </Button>
        </div>
      </Modal>
    </>
  )
}
