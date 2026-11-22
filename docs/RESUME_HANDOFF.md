# Resume handoff

State: M0 and M1 done (see PROGRESS.md). Live: https://musubi-studio.c-notesacc12.workers.dev. Push to `main` auto-deploys via Workers Builds; work on feature branches and merge PRs via `gh api` REST (GraphQL is blocked in this sandbox).

Open items:
1. Create a Clerk webhook (dashboard -> Webhooks) to `https://musubi-studio.c-notesacc12.workers.dev/api/webhooks/clerk` (user.created/updated/deleted); set `CLERK_WEBHOOK_SIGNING_SECRET` as a Worker secret. Until then `ensureUser` lazily creates users on first deck creation.
2. Worker secrets live in the dashboard / API (not `.env.local`). Set via `PUT /accounts/{id}/workers/scripts/musubi-studio/secrets`.
3. Later milestones need Liveblocks + Upstash keys, Inngest keys, sandbox network allowlist for those hosts.

Next: M2 (FSRS engine + study modes).
