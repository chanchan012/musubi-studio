# Musubi — Progress

## Roadmap
- [x] **M0 Infrastructure** — live at https://musubi-studio.c-notesacc12.workers.dev (`/api/health` 200). Pending for later: Inngest keys (M5), Liveblocks (M4), Upstash (M4), R2 S3 keys (M1)
- [x] M1 Auth, Neon schema & R2 storage — schema applied to Neon, ACL, Clerk webhook, deck + upload routes, R2 presign (14 Vitest tests). Webhook secret set; pending: live R2 upload smoke test with a signed-in user
- [x] M2 FSRS & study technique engine — engine + API done (39 tests). Study UI (flip card, rating buttons, timer, blurt box, Feynman prompt, dual-coding view, mastery ladder) is built with the screens in M3/M4 since `/dashboard` and `/studio` do not exist yet
- [x] M3 Board-exam mock & strategy engine — CBM, strike/trap tags, 90s nudge, two-pass, error journal + Day 1/3/7 re-drill, `/api/exam/*`, exam runner UI, landing + auth + minimal dashboard, Playwright at 375/768/1440 (59 unit + 17 e2e tests). Not yet: study (flashcard) screens, full dashboard (due queue, weak-topic radar, MCP modal), `/community`
- [~] M4 Collaborative studio & Cloudflare Code Mode MCP — built: `/studio/[id]` (list/editor, undo/redo with Human/AI attribution, presence + soft locks, Yjs rationale editor, comment threads, connect-agent modal), `/api/studio/*`, `/api/mcp` (Code Mode, `LOADER` worker-loader binding) + `/api/mcp/direct` (8 Zod tools), personal tokens (sha256), Upstash limits. Pending live verification. Also fixed: OpenNext `cookie@0.7.2` pin (Error 1101).
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

## M1 log
- Neon migration `drizzle/0000_init.sql` applied via Neon MCP in one transaction (drizzle journal table not populated; apply future migrations the same way or with `drizzle-kit migrate` on a machine that can reach Neon).
- R2 S3 credentials: account API token `musubi-r2-s3` (id `54a3973c7d57194a5aa4c0a6dbc10d49`, R2 Write on `musubi-assets` only). Stored as Worker secrets `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; also `CLOUDFLARE_ACCOUNT_ID` and `DATABASE_URL`. Not in `.env.local` (secret value never retrieved locally).
- `R2_PUBLIC_URL` intentionally unset: bucket stays private, reads use presigned GET after an ACL check.

## M2 log
- `ts-fsrs` 6.0.1 (FSRS-6), retention default 0.90 (clamped 0.70–0.97), fuzz off for deterministic previews.
- Migration `drizzle/0001_study_engine.sql` (feynman_notes, items.compare_table) applied via Neon MCP.
- Modes: FSRS review (`lib/fsrs.ts`), blurting (`lib/blurt.ts`), interleave mixer (`lib/interleave.ts`, seeded), Feynman (`needsFeynman` + `/study/feynman`), dual coding (`mode=dual` filters items with a diagram; `compare_table` column), Pomodoro/Flowtime + Leitner (`lib/focus.ts`, `lib/leitner.ts`).

## M3 log
- Engine: `lib/cbm.ts`, `lib/exam-fsrs.ts` (dangerous misconception -> stability<=0.5, relearn in 10 min; lucky guess -> due <=1 day), `lib/error-log.ts`, `lib/exam-state.ts` (pure state machine).
- API: `GET /exam/:deckId/questions` (no answers leaked), `POST /exam/submit` (grades server-side, writes attempts, review_states, item_stats distractor counts, error_log), `GET /exam/errors`, `PATCH /exam/errors/:id`, `GET /exam/redrill`.
- UI: `components/ExamRunner.tsx` (also powers the landing sandbox with local grading in `lib/demo.ts`), `CalibrationMatrix.tsx`; pages `/`, `/sign-in`, `/sign-up`, `/dashboard`, `/exam/[id]`.
- Playwright runs against `next start` with `E2E_NO_AUTH=1` (skips Clerk middleware; the sandbox cannot reach Clerk's dev handshake host). Run `pnpm e2e:full`.
- `.env.production` holds public Clerk build-time vars (publishable key + sign-in URLs).
