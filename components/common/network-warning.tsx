"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/components/providers/wallet-provider"

export function NetworkWarning() {
  const { wrongNetwork, switchNetwork } = useWallet()
  if (!wrongNetwork) return null

  return (
    <div className="flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm text-warning-foreground">
      <AlertTriangle className="size-4 shrink-0" />
      <span>You are on the wrong network. FAPEX requires Sepolia Testnet.</span>
      <Button size="sm" variant="secondary" onClick={switchNetwork} className="h-7">
        Switch to Sepolia
      </Button>
    </div>
  )
}
