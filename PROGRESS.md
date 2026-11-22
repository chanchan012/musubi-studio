# Musubi — Progress

## Roadmap
- [~] **M0 Infrastructure** — scaffold ✅, Neon db ✅, Clerk app ✅, R2 bucket ✅, OpenNext build ✅; pending: GitHub repo push, Clerk secret key, Inngest keys, first deploy + live `/api/health`
- [ ] M1 Auth, Neon schema & R2 storage
- [ ] M2 FSRS & study technique engine
- [ ] M3 Board-exam mock & strategy engine
- [ ] M4 Collaborative studio & Cloudflare Code Mode MCP
- [ ] M5 Community question bank & Inngest jobs
- [ ] M6 E2E verification

## M0 log
- Deploy target: Cloudflare **Workers** via `@opennextjs/cloudflare` (Pages can't host OpenNext/Next 16).
- Neon: project `still-bird-86777802` (chanchan-new-projects), branch `br-weathered-meadow-b4sbechg`, database `musubi`.
- Clerk: app `app_3MSjQrYvRaNCvxdZlU3ajQgJ8RJ` "musubi", **development** instance.
- R2: bucket `musubi-assets` (ENAM).
- Verified: `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm cf:build` all pass locally.
