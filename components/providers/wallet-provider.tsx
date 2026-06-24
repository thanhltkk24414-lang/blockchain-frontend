"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { CHAIN } from "@/lib/contracts"
import { DEMO_WALLET } from "@/lib/mock-data"
import type { Role } from "@/lib/types"

interface WalletState {
  connected: boolean
  connecting: boolean
  address: string
  ethBalance: number
  usdcBalance: number
  chainId: number
  wrongNetwork: boolean
  role: Role
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: () => Promise<void>
  setRole: (r: Role) => void
}

const WalletContext = createContext<WalletState | null>(null)

// Minimal injected provider typing
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [address, setAddress] = useState(DEMO_WALLET.address)
  const [chainId, setChainId] = useState(CHAIN.id)
  const [role, setRoleState] = useState<Role>("client")

  // Restore session
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("fapex_wallet") : null
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setConnected(true)
        setAddress(data.address ?? DEMO_WALLET.address)
        setRoleState(data.role ?? "client")
        setChainId(data.chainId ?? CHAIN.id)
      } catch {
        /* ignore */
      }
    }
  }, [])

  const persist = useCallback((next: { address: string; role: Role; chainId: number }) => {
    window.localStorage.setItem("fapex_wallet", JSON.stringify(next))
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    try {
      let addr = DEMO_WALLET.address
      let cid = CHAIN.id
      // Try a real injected wallet if present, otherwise fall back to demo mode.
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[]
          if (accounts?.[0]) addr = accounts[0]
          const hexChain = (await window.ethereum.request({ method: "eth_chainId" })) as string
          cid = Number.parseInt(hexChain, 16)
        } catch {
          // user rejected — stay in demo mode
        }
      } else {
        // simulate a brief connection delay in demo mode
        await new Promise((r) => setTimeout(r, 700))
      }
      setAddress(addr)
      setChainId(cid)
      setConnected(true)
      persist({ address: addr, role, chainId: cid })
    } finally {
      setConnecting(false)
    }
  }, [persist, role])

  const disconnect = useCallback(() => {
    setConnected(false)
    setAddress(DEMO_WALLET.address)
    setChainId(CHAIN.id)
    window.localStorage.removeItem("fapex_wallet")
  }, [])

  const switchNetwork = useCallback(async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${CHAIN.id.toString(16)}` }],
        })
      } catch {
        /* ignore in demo */
      }
    }
    setChainId(CHAIN.id)
    persist({ address, role, chainId: CHAIN.id })
  }, [address, persist, role])

  const setRole = useCallback(
    (r: Role) => {
      setRoleState(r)
      if (connected) persist({ address, role: r, chainId })
    },
    [address, chainId, connected, persist],
  )

  const value = useMemo<WalletState>(
    () => ({
      connected,
      connecting,
      address,
      ethBalance: DEMO_WALLET.ethBalance,
      usdcBalance: DEMO_WALLET.usdcBalance,
      chainId,
      wrongNetwork: connected && chainId !== CHAIN.id,
      role,
      connect,
      disconnect,
      switchNetwork,
      setRole,
    }),
    [connected, connecting, address, chainId, role, connect, disconnect, switchNetwork, setRole],
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}
