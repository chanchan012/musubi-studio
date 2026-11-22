# Resume handoff

State: M0, M1, M2 done (see PROGRESS.md). Live: https://musubi-studio.c-notesacc12.workers.dev. Push to `main` auto-deploys via Workers Builds; work on feature branches and merge PRs via `gh api` REST (GraphQL is blocked in this sandbox).

Open items:
1. Clerk webhook configured and secret set (done).
2. Worker secrets live in the dashboard / API (not `.env.local`). Set via `PUT /accounts/{id}/workers/scripts/musubi-studio/secrets`.
3. Later milestones need Liveblocks + Upstash keys, Inngest keys, sandbox network allowlist for those hosts.

Next: M3 (exam runner + CBM, strategy tools, error journal) — also introduces the first UI screens and Playwright viewport tests.
