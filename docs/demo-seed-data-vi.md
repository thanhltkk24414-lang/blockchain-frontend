# Dữ liệu demo & luồng escrow (tiếng Việt)

Hướng dẫn ngắn cho demo Fapex trên Sepolia testnet.

## Ví quan trọng

| Vai trò | Mô tả |
|--------|--------|
| **SIWE user** | Ví bạn đăng nhập trên `/profile` (JWT). Dùng để tạo job, accept bid trong DB. |
| **Client on-chain** | Ví thực sự gọi `createJob` trên JobRegistry — hiện là **INDEXER_PRIVATE_KEY** trên backend Railway. |
| **Freelancer** | Ví gửi proposal / nhận tiền sau khi hoàn thành. |

Nếu SIWE user ≠ client on-chain, **accept bid** vẫn OK (backend relay `assignFreelancer`), nhưng **nạp escrow** phải dùng ví client on-chain trong MetaMask.

## Sepolia ETH ≠ MockUSDC (quan trọng)

| Token | Mục đích | Cách lấy |
|-------|----------|----------|
| **Sepolia ETH** | Trả phí gas (approve, deposit, mint…) | Faucet ETH Sepolia (MetaMask, Alchemy, v.v.) |
| **MockUSDC** | Tiền ký quỹ escrow | **Mint** từ contract Fapex — **không** có trong faucet ETH |

UI hiển thị **0 USDC** nghĩa là ví **chưa có MockUSDC** tại contract đúng — không phải lỗi địa chỉ nếu bạn chỉ mới có ETH.

**Contract MockUSDC trên Sepolia (Fapex):**

`0x2293193Eaa5CE5253d5e081046a06dB077f26f8e`

Đây **không** phải USDC Circle (`0x1c7D4B…`) hay token test từ faucet USDC ngẫu nhiên.

## Cách mint 1000 MockUSDC (3 cách)

### Cách 1 — Nút trong UI (khuyên dùng)

1. MetaMask: mạng **Sepolia**, ví **client on-chain** (trùng `onchainClientAddress` trên trang job).
2. Vào job đã accept bid → mục **Fund escrow**.
3. Nếu số dư &lt; tổng nạp, bấm **Mint 1,000 test USDC** → ký giao dịch (cần chút Sepolia ETH làm gas).
4. Sau khi mint xong, bấm **Approve & deposit escrow**.

### Cách 2 — Etherscan Write Contract

1. Mở [MockUSDC trên Sepolia Etherscan](https://sepolia.etherscan.io/address/0x2293193Eaa5CE5253d5e081046a06dB077f26f8e#writeContract).
2. Connect ví client on-chain.
3. Hàm **`mint`**:
   - `to`: địa chỉ ví của bạn (client on-chain)
   - `amount`: `1000000000` (= 1000 USDC, 6 chữ số thập phân)
4. Write → confirm trong MetaMask.

### Cách 3 — Foundry `cast` (CLI)

```bash
cast send 0x2293193Eaa5CE5253d5e081046a06dB077f26f8e \
  "mint(address,uint256)" \
  0xYOUR_WALLET \
  1000000000 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

Thay `0xYOUR_WALLET` bằng ví client on-chain. `1000000000` = 1000 USDC (6 decimals).

## Nạp ký quỹ (Fund escrow) là gì?

Sau khi chấp nhận freelancer:

1. Client **approve** MockUSDC cho `EscrowVault` (`0xf2143d1EA4D5a8716344c2cef862f9ed41244ED5`).
2. Client gọi **`depositEscrow(jobId, freelancer)`** — khóa tiền on-chain.
3. Tổng nạp = **giá job + 3% phí nền tảng** (ví dụ job 100 USDC → nạp 103 USDC).

Tiền nằm trong escrow cho đến khi client approve bàn giao hoặc hết thời gian review.

## Luồng demo đề xuất

1. Đăng nhập SIWE (`/profile`) — Sepolia.
2. Tạo job (`/client`) — backend IPFS + `createJob` on-chain.
3. Freelancer bid (`/jobs/:id`).
4. Client **Accept & assign** — backend relay, không cần MetaMask cho bước này.
5. Chuyển MetaMask sang **ví client on-chain**, **mint MockUSDC** (nút UI hoặc Etherscan), rồi **Fund escrow**.
6. Freelancer `startWork` → `submitWork` → client `approveAndRelease`.

## Job mẫu

Xem [demo-jobs.md](./demo-jobs.md) (tiếng Anh) — 3 job Development / Design / Writing.

## API thử nhanh

`backend/api-tests.http` — SIWE → `POST /api/jobs` → `PATCH /api/bids/:id/accept`.

## Biến môi trường frontend

Xem `frontend/.env.example`. Địa chỉ mặc định lấy từ `deployments/sepolia.json` nếu không set `VITE_MOCK_USDC_ADDRESS`.
