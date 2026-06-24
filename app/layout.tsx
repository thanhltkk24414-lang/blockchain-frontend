import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { WalletProvider } from "@/components/providers/wallet-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" })

export const metadata: Metadata = {
  title: "FAPEX — Decentralized Freelance Marketplace",
  description:
    "FAPEX connects clients and freelancers with on-chain smart contracts, escrow, milestone payments and transparent dispute resolution on Sepolia.",
  keywords: ["Web3", "freelance", "blockchain", "smart contract", "escrow", "DAO", "FAPEX"],
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <WalletProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </WalletProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
