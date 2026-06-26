# Fapex — Admin & on-chain roles (Sepolia)

Tài liệu ngắn về quyền admin / grant role trên smart contracts Fapex. **Không có trang Admin trong frontend canonical** (`frontend/src`) — thao tác qua Hardhat / cast / Etherscan.

## Deployer / INDEXER (production Sepolia)

| Vai trò | Địa chỉ |
|--------|---------|
| INDEXER / deployer | `0x523eBd853a1638065f148A05c0Ca423E490D92f7` |
| JobRegistry | `0xE5425cFE21BAe73d54138Bb290B671bF4c55FBC9` |

Sau `scripts/deploy.js`, **deployer là admin** trên tất cả core contracts. Backend `INDEXER_PRIVATE_KEY` dùng ví deployer để **đọc events** và relay admin — **không** gọi `createJob` thay client (client ký từ MetaMask).

## Contracts & roles

### MockUSDC

- **`mint(to, amount)`** — **permissionless** trên testnet (ai cũng mint được cho ví mình).
- Không có `grantRole` / AccessControl.
- UI: nút **Mint test USDC** trên trang client job (`EscrowDepositPanel`).

### JobRegistry, ReputationStore, PlatformTreasury, ArbitratorPanel, EscrowVault

- Mô hình **single admin** + `transferAdmin(newAdmin)` (không phải OpenZeppelin AccessControl đầy đủ trên mọi contract).
- **`setAuthorizedContract(addr, true)`** — chỉ admin; đã wire lúc deploy giữa registry / escrow / treasury / reputation / panel.

### EscrowVault (delegated roles)

Admin có thể gọi:

```text
grantRole(addr, ROLE_PAUSER)
grantRole(addr, ROLE_FORCE_RESOLVER)
```

Dùng khi cần pause hoặc force-resolve escrow (vận hành / demo).

### ArbitratorPanel

```text
grantRole(addr, ROLE_ARBITRATOR_MANAGER)
```

Quản lý pool arbitrator (ngoài stake 50 USDC qua PlatformTreasury).

### PlatformTreasury

- Admin: cấu hình / rút phí nền tảng (tùy implementation).
- Arbitrator **stake** ≥ 50 MockUSDC — permissionless cho từng ví (`stake`), không cần admin.

### ReputationStore

- Admin + `setAuthorizedContract` cho JobRegistry / EscrowVault / ArbitratorPanel.
- Không có UI grant reputation — cập nhật qua on-chain job lifecycle.

## Backend

- **Không có** `/api/admin/*` routes.
- User `role: 'admin'` trong Mongo **chưa** được dùng cho grant on-chain.

## Scripts (repo root)

| Script | Mục đích |
|--------|----------|
| `scripts/deploy.js` | Deploy + wire `setAuthorizedContract` |
| `scripts/grant-platform-roles.js` | Grant `ROLE_ARBITRATOR_MANAGER` / pauser (xem file) |
| `scripts/seed-arbitrator-pool.js` | Seed arbitrator demo |

## Gợi ý thao tác admin (Hardhat console)

```javascript
const panel = await ethers.getContractAt("ArbitratorPanel", "0x...");
const ROLE_ARBITRATOR_MANAGER = await panel.ROLE_ARBITRATOR_MANAGER();
await panel.grantRole("0xYourManager...", ROLE_ARBITRATOR_MANAGER);
```

## Thiếu / không build thêm

- Trang Admin React trong `frontend/src` — **chưa có** (cố ý minimal).
- Mint USDC production — không áp dụng; Sepolia dùng MockUSDC public mint.
- Rotate admin — gọi `transferAdmin` trên từng contract khi đổi ví deployer.
