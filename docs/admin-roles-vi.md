# Fapex — Admin & on-chain roles (Sepolia)

Tài liệu ngắn về quyền admin / grant role trên smart contracts Fapex. **Trang Admin** tại route **`/admin`** (`frontend/src/pages/AdminDashboardPage.tsx`) — thao tác on-chain qua MetaMask; MongoDB không có RBAC admin.

## Deployer / INDEXER (production Sepolia)

| Vai trò | Địa chỉ |
|--------|---------|
| INDEXER / deployer | `0x523eBd853a1638065f148A05c0Ca423E490D92f7` |
| JobRegistry | `0x302629f82d51b0972ffc3A99cbE355F4acEf908d` |

Sau `scripts/deploy.js`, **deployer là admin** trên tất cả core contracts. Backend `INDEXER_PRIVATE_KEY` dùng ví deployer để **đọc events** — **không** gọi `createJob` thay client (client ký từ MetaMask).

## Contracts & roles

### MockUSDC

- **`mint(to, amount)`** — **permissionless** trên testnet.
- Không có `grantRole` / AccessControl.

### JobRegistry, ReputationStore, PlatformTreasury, ArbitratorPanel, EscrowVault

- Mô hình **single admin** + `transferAdmin(newAdmin)` + delegated `grantRole` trên EscrowVault / ArbitratorPanel.
- **`setAuthorizedContract(addr, true)`** — chỉ admin; wire lúc deploy.

### EscrowVault (delegated roles)

```text
grantRole(addr, ROLE_PAUSER)
grantRole(addr, ROLE_FORCE_RESOLVER)
```

- **Pauser:** `setPaused` — khẩn cấp, UI có modal xác nhận trước khi pause.
- **Force resolver:** `adminForceResolve` — **chỉ khi quorum fail**; UI đọc on-chain trước khi bật nút (xem bên dưới).

### ArbitratorPanel

```text
grantRole(addr, ROLE_ARBITRATOR_MANAGER)
```

Quản lý pool arbitrator (`joinPool` cho ví khác).

## Trang `/admin` — demo talking points

### One-liner

> *Governance là wallet-gated on-chain; dashboard chỉ là lớp UI mỏng trên hàm admin có sẵn — không phải backdoor off-chain.*

### Force resolve vs “admin chọn người thắng”

1. **Luồng bình thường:** 5 arbitrator sortition → commit–reveal → quorum ≥3 → `finalizeDisputeVoting` → `executeArbitrationResult`. Admin **không** tham gia chọn kết quả.
2. **Force resolve:** Chỉ khi sau cửa reveal vẫn **&lt;3** vote hợp lệ. UI **tắt nút** nếu job chưa DISPUTED, reveal chưa hết, hoặc đã đủ quorum.
3. **On-chain thật:** Contract vẫn cho phép admin gọi sớm (MVP) — UI + docs là lớp minh bạch; production roadmap: multisig + timelock + chỉ grant `ROLE_FORCE_RESOLVER` cho multisig.
4. **Audit:** Mọi force resolve emit `AdminForceResolved` trên Etherscan — không thể giấu.

### Các panel trên dashboard

| Panel | Mục đích demo |
|-------|----------------|
| How governance works | So sánh normal vs emergency; bảng ai làm gì |
| Your access | Badge role ví đang connect |
| Emergency pause | Modal confirm trước pause |
| Grant / revoke roles | Cảnh báo đỏ khi chọn force_resolver; liệt kê holder (deployer/admin/địa chỉ nhập) |
| Force resolve | Snapshot phase, reveal count, arbitrators; gõ `FORCE` + checkbox |

### Backend

- `GET /api/admin/stats` — job counts, indexer block (read-only cache).
- **Không** có off-chain quyền grant role.

## Scripts (repo root)

| Script | Mục đích |
|--------|----------|
| `scripts/deploy.js` | Deploy + wire |
| `scripts/grant-platform-roles.js` | Grant delegated roles |
| `scripts/seed-arbitrator-pool.js` | Seed arbitrator demo |

## Production roadmap (nói khi bị hỏi)

- `transferAdmin` → Gnosis Safe multisig
- Timelock cho pause / force resolve
- Force resolver chỉ trên multisig; lý do khẩn cấp ghi công khai trước tx

## Tài liệu liên quan

- [admin-cheatsheet-vi.md](../../docs/guides/admin-cheatsheet-vi.md) (monorepo docs)
- [demo-qa-defense-vi.md](../../docs/guides/demo-qa-defense-vi.md) — mục Force resolve vs thao túng
- [contract-interaction.md](../../docs/guides/contract-interaction.md)
