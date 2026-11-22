# Resume handoff

State: M0–M3 done (see PROGRESS.md). Live: https://musubi-studio.c-notesacc12.workers.dev. Push to `main` auto-deploys via Workers Builds; work on feature branches and merge PRs via `gh api` REST (GraphQL is blocked in this sandbox).

Open items:
1. Clerk webhook configured and secret set (done).
2. Worker secrets live in the dashboard / API (not `.env.local`). Set via `PUT /accounts/{id}/workers/scripts/musubi-studio/secrets`.
3. Later milestones need Liveblocks + Upstash keys, Inngest keys, sandbox network allowlist for those hosts.

Next: fix live Clerk browser handshake (Error 1101 on `?__clerk_handshake=`), then M4 (studio, Liveblocks, MCP + Code Mode).
