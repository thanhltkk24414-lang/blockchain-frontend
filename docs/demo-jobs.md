# Demo jobs for presentations

For live demos, **3–5 jobs across 3 categories** is ideal. Do **not** auto-seed production databases.

## Recommended sample jobs

Create these via **Client dashboard → Create job** (or `POST /api/jobs` with SIWE JWT).

### 1. Development — Smart Contract Audit

| Field | Value |
|-------|-------|
| Title | Smart Contract Audit for Escrow dApp |
| Description | Audit Solidity escrow and registry contracts on Sepolia for reentrancy, access control, and fee logic. |
| Category | development |
| Skills | Solidity, Security, Hardhat |
| Budget | 500 USDC |
| Duration | 14 days |
| Deliverables | PDF audit report with severity-ranked findings and remediation notes. |
| Acceptance criteria | All critical/high issues documented with reproducible steps; medium/low in appendix. |

### 2. Design — Landing Page UI

| Field | Value |
|-------|-------|
| Title | Fapex Marketing Landing Page Redesign |
| Description | Redesign the Fapex freelance marketplace landing page with a dark theme, clear CTAs, and mobile-first layout. |
| Category | design |
| Skills | Figma, UI/UX, Web Design |
| Budget | 250 USDC |
| Duration | 7 days |
| Deliverables | Figma file with desktop/mobile frames and exported assets. |
| Acceptance criteria | Matches brand colors; includes hero, features, roles, and footer sections. |

### 3. Writing — Technical Blog Series

| Field | Value |
|-------|-------|
| Title | Web3 Freelance Escrow Blog Series |
| Description | Write a 3-part blog series explaining on-chain escrow, USDC deposits, and dispute resolution for developers. |
| Category | writing |
| Skills | Technical Writing, Web3, SEO |
| Budget | 150 USDC |
| Duration | 10 days |
| Deliverables | Three 1,200-word articles with code snippets and diagrams. |
| Acceptance criteria | Published-ready copy; accurate references to JobRegistry and EscrowVault flows. |

### Optional extras (4–5)

- **Marketing** — Twitter/X thread campaign for Fapex launch (200 USDC, 5 days)
- **Development** — Integrate RainbowKit SIWE login into existing React app (300 USDC, 7 days)

## Escrow demo flow

1. Sign in on `/profile` (SIWE) with Sepolia wallet.
2. Create a job on `/client` — backend uploads metadata to IPFS and calls `createJob` on-chain.
3. Open `/client/jobs/:id` — confirm `onchainJobId` links to JobRegistry on Etherscan.
4. Mint MockUSDC on Sepolia if needed (testnet faucet / contract `mint`).
5. **Approve & deposit escrow** — enter freelancer `0x…` address (manual until bids API in Phase 3).
6. Confirm txs in `TxStatusModal` and on [Sepolia Etherscan](https://sepolia.etherscan.io).

## Optional local seed (manual)

There is no production seed script. For local MongoDB, use `backend/api-tests.http` `POST /api/jobs` with a valid JWT, or repeat the UI create flow above.
