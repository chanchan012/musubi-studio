# Resume handoff

State: M0 mostly done (see PROGRESS.md). Code lives in this directory; `.env.local` is gitignored.

Next steps:
1. Fill missing values in `.env.local` (CLERK_SECRET_KEY, CLOUDFLARE_*, R2_*, LIVEBLOCKS_*, UPSTASH_*, INNGEST_*).
2. Attach the GitHub repo (`musubi-studio`), push `main`.
3. `pnpm cf:deploy`, then `curl https://musubi.<subdomain>.workers.dev/api/health`.
4. Start M1.
