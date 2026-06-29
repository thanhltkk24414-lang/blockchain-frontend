# FAPEX — Frontend

> Vite + React 19 + wagmi + RainbowKit — Web3 freelance UI on Sepolia.

Submodule của monorepo [`Blockchain`](../README.md). Deploy: **Vercel** (`*.vercel.app`).

**Cập nhật:** 2026-06-30

---

## Features

| Tính năng | Mô tả |
|-----------|--------|
| **Wallet** | RainbowKit + MetaMask, Sepolia only |
| **Auth** | SIWE sign-in → JWT API calls |
| **Roles** | Client, Freelancer, Arbitrator dashboards |
| **On-chain tx** | createJob, escrow, work, dispute, stake |
| **Theme** | Light / dark |
| **Language** | English UI |
| **Realtime** | Socket.io job/dispute updates |

---

## Quick start

```bash
cd frontend
npm install
cp .env.example .env
npm run dev      # http://localhost:3000
npm run build    # Vercel production
```

---

## Environment variables

| Variable | Mô tả |
|----------|--------|
| `VITE_API_URL` | Backend base URL |
| `VITE_CHAIN_ID` | `11155111` (Sepolia) |
| `VITE_JOB_REGISTRY_ADDRESS` | `0x302629f82d51b0972ffc3A99cbE355F4acEf908d` |

Production API: `https://fapex-backend-production.up.railway.app`

---

## Docs

- [Manual (VI)](../docs/guides/manual-vi.md)
- [Platform mechanisms](../docs/guides/platform-mechanisms-vi.md)
- [Demo Q&A](../docs/guides/demo-qa-defense-vi.md)
