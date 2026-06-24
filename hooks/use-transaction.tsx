"use client"

import { useCallback, useState } from "react"
import type { TxStatus } from "@/lib/types"

function randomHash(): string {
  const chars = "0123456789abcdef"
  let h = "0x"
  for (let i = 0; i < 64; i++) h += chars[Math.floor(Math.random() * 16)]
  return h
}

interface TxState {
  status: TxStatus
  hash: string
  label: string
  error?: string
}

/**
 * Simulates an on-chain transaction lifecycle (idle -> pending -> success/failed).
 * In demo mode this resolves after a short delay with a generated tx hash.
 */
export function useTransaction() {
  const [tx, setTx] = useState<TxState>({ status: "idle", hash: "", label: "" })

  const run = useCallback(async (label: string, onSuccess?: () => void) => {
    const hash = randomHash()
    setTx({ status: "pending", hash, label })
    await new Promise((r) => setTimeout(r, 1800))
    // 92% success rate to demonstrate the failed state occasionally
    const ok = Math.random() > 0.08
    if (ok) {
      setTx({ status: "success", hash, label })
      onSuccess?.()
    } else {
      setTx({ status: "failed", hash, label, error: "Transaction reverted by the EVM. Please try again." })
    }
    return ok
  }, [])

  const reset = useCallback(() => setTx({ status: "idle", hash: "", label: "" }), [])

  return { tx, run, reset }
}
