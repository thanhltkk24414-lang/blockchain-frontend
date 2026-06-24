# Dữ liệu demo & luồng escrow (tiếng Việt)

Hướng dẫn ngắn cho demo Fapex trên Sepolia testnet.

## Ví quan trọng

| Vai trò | Mô tả |
|--------|--------|
| **SIWE user** | Ví bạn đăng nhập trên `/profile` (JWT). Dùng để tạo job, accept bid trong DB. |
| **Client on-chain** | Ví thực sự gọi `createJob` trên JobRegistry — hiện là **INDEXER_PRIVATE_KEY** trên backend Railway. |
| **Freelancer** | Ví gửi proposal / nhận tiền sau khi hoàn thành. |

Nếu SIWE user ≠ client on-chain, **accept bid** vẫn OK (backend relay `assignFreelancer`), nhưng **nạp escrow** phải dùng ví client on-chain trong MetaMask.

## Nạp ký quỹ (Fund escrow) là gì?

Sau khi chấp nhận freelancer:

1. Client **approve** MockUSDC cho `EscrowVault`.
2. Client gọi **`depositEscrow(jobId, freelancer)`** — khóa tiền on-chain.
3. Tổng nạp = **giá job + 3% phí nền tảng** (ví dụ job 100 USDC → nạp 103 USDC).

Tiền nằm trong escrow cho đến khi client approve bàn giao hoặc hết thời gian review.

## MockUSDC trên Sepolia

- Số dư **0 USDC** trong UI nghĩa là ví chưa có token test.
- Cần **mint MockUSDC** trên Sepolia (contract trong `.env` / `CONTRACT_ADDRESSES.MockUSDC`).
- Dùng ví **client on-chain** (INDEXER) để mint và nạp escrow trong demo production.

## Luồng demo đề xuất

1. Đăng nhập SIWE (`/profile`) — Sepolia.
2. Tạo job (`/client`) — backend IPFS + `createJob` on-chain.
3. Freelancer bid (`/jobs/:id`).
4. Client **Accept & assign** — backend relay, không cần MetaMask cho bước này.
5. Chuyển MetaMask sang **ví client on-chain**, mint MockUSDC, **Fund escrow**.
6. Freelancer `startWork` → `submitWork` → client `approveAndRelease`.

## Job mẫu

Xem [demo-jobs.md](./demo-jobs.md) (tiếng Anh) — 3 job Development / Design / Writing.

## API thử nhanh

`backend/api-tests.http` — SIWE → `POST /api/jobs` → `PATCH /api/bids/:id/accept`.
