# Musubi — Progress

## Roadmap
- [x] **M0 Infrastructure** — live at https://musubi-studio.c-notesacc12.workers.dev (`/api/health` 200). Pending for later: Inngest keys (M5), Liveblocks (M4), Upstash (M4), R2 S3 keys (M1)
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

- Deploy: Cloudflare Workers Builds connected to GitHub `main` (Worker name `musubi-studio`); runtime secrets set in dashboard (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- Sandbox env `musubi-studio` allowlists the live host for health checks.
