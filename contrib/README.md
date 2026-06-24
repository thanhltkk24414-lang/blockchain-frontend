# Contributor reference trees (not built by default)

This folder documents duplicate frontend uploads. **The canonical app is the Vite scaffold in `src/`.**

| Path | Origin | Framework | Status |
|------|--------|-----------|--------|
| `src/` | Scaffold commit `391b352` + Phase 1 integration | Vite + React | **Active** — run `npm run dev` |
| `app/`, `components/`, `hooks/`, `lib/` (repo root) | v0 marketing landing export | Next.js (App Router) | Reference only — uses `next/image`, `next/link`, Tailwind |
| `fapex-frontend/` | Contributors 1 & 2 full UI | Next.js 14 | Reference — pages, forms, tests; API paths partially wrong |

## Migration plan

1. Port UI from `fapex-frontend/src/components/` into `src/components/` as Vite-compatible modules.
2. Replace `fapex-frontend` mock API fallbacks with `src/lib/api/client.ts` (real backend).
3. Adopt v0 marketing styles from root `components/marketing/` into `src/pages/LandingPage.tsx` or add Tailwind to Vite.
4. Remove or archive `fapex-frontend/.next` before commits (gitignored).

Do not run two frameworks from the same package.json. Pick Vite for the integrated dApp.
