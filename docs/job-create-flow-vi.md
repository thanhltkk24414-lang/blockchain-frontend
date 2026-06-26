# Luồng tạo job & nạp escrow (Sepolia demo)

> Cập nhật: 2026-06-26 — client ký `createJob` từ ví MetaMask; **không** relay INDEXER.

## Vì sao luồng cũ sai?

| Vấn đề | Hậu quả |
|--------|---------|
| Backend INDEXER gọi `createJob` | `msg.sender` on-chain = ví deployer (`0x523e…`), không phải client SIWE |
| `depositEscrow` có modifier **OnlyClient** | Chỉ ví on-chain client mới nạp được — client phải chuyển sang ví INDEXER |
| Mint MockUSDC trên ví SIWE | USDC vào ví sai → không dùng được cho deposit → UX vô nghĩa |

`JobRegistry.createJob` **không** nhận tham số `_client` — client luôn là `msg.sender`. Không có relayer pattern trong contract hiện tại.

## Giải pháp (không redeploy)

**Option A — client ký `createJob` trên frontend** (đã triển khai):

1. Client SIWE + MetaMask cùng một ví.
2. Upload metadata IPFS qua API.
3. MetaMask ký `JobRegistry.createJob(metadataCID, value, duration)` — cần **Sepolia ETH** (gas).
4. `POST /api/jobs` với `onchainJobId` + `metadataCID` — backend verify client on-chain = ví SIWE, lưu MongoDB.
5. Accept bid → client **cùng ví** mint MockUSDC (nếu cần) → `approve` + `depositEscrow`.

INDEXER backend chỉ còn: đọc events, sync MongoDB, các relay admin (không tạo job).

## Các bước cho người dùng sau khi deploy code

1. **Faucet Sepolia ETH** cho ví client (gas `createJob` + `depositEscrow`).
2. Đăng nhập SIWE bằng ví đó — **giữ cùng ví** trong MetaMask khi tạo job. Fapex chỉ hỗ trợ MetaMask (không WalletConnect / Coinbase / Rainbow).
3. Client dashboard → **Create job** → xác nhận 2 bước: tx on-chain rồi lưu API.
4. Freelancer bid → client accept.
5. Trên trang job: **Mint test USDC** (ví client) → **Approve & deposit escrow**.

## Job cũ (tạo trước khi sửa)

- On-chain client vẫn là ví INDEXER — deposit phải dùng ví đó hoặc **tạo job mới** với luồng mới.

## File liên quan

| Layer | Path |
|-------|------|
| FE create | `frontend/src/components/client/CreateJobForm.tsx`, `hooks/useCreateJob.ts` |
| FE escrow | `frontend/src/components/client/EscrowDepositPanel.tsx` |
| BE register | `backend/src/controllers/jobController.js` |
| Contract | `JobRegistry.createJob` — client = `msg.sender` |
