import Link from "next/link";
import { DemoExam } from "@/components/DemoExam";

const TECHNIQUES = [
  ["FSRS spaced repetition", "Scheduled by memory stability and retrievability, with the exact next interval shown on every button."],
  ["Blurting", "Write what you know before the answer appears. Retrieval effort, not recognition."],
  ["Interleaved mixer", "Subjects shuffled inside a block so you learn to tell concepts apart."],
  ["Feynman self-explanation", "Explain the misses in plain words; a connected AI agent can sharpen them."],
  ["Dual coding", "Diagram beside a comparison table, so you encode both visually and verbally."],
  ["Focus cadence", "25/5 or 50/10 timers and a four-step mastery ladder from New to Board-Ready."],
];

const STRATEGY = [
  ["Certainty-based marking", "Rate C1–C3 before you submit. Sure and wrong is a dangerous misconception; a lucky guess stays in rotation."],
  ["Eliminate and tag", "Strike distractors with X and note the trap: extreme wording, opposite pair, unit slip."],
  ["Two-pass pacing", "A stopwatch per question and a nudge at 90 seconds to flag it and move on."],
  ["Mistake journal", "Misses are logged with a root cause and re-tested on Day 1, 3 and 7."],
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 text-lg font-semibold"><span aria-hidden className="text-2xl text-seal">結</span> Musubi</span>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 hover:bg-card">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-ink px-3 py-2 font-medium text-paper">Start free</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-start lg:gap-12 lg:pt-12">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-seal">Board-exam studio</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Tie what you know to what you’ll be asked.</h1>
            <p className="mt-4 max-w-prose text-lg text-muted">
              Build flashcards and board-style questions together, in real time, with classmates and your own AI coding agent. Then sit mock blocks that train judgement as well as recall.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/sign-up" className="rounded-lg bg-seal px-5 py-3 font-medium text-white">Create a deck</Link>
              <a href="#try" className="rounded-lg border border-line px-5 py-3">Try a question</a>
            </div>
            <p className="mt-4 text-sm text-muted">Free to use. Bring your own agent — Claude Code, Claude Desktop or Cursor — over MCP.</p>
          </div>

          <div id="try" className="scroll-mt-4 overflow-hidden rounded-xl border border-line bg-card shadow-[0_1px_0_var(--line),0_12px_30px_-18px_rgba(20,20,19,0.35)]">
            <DemoExam />
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Six ways to learn</h2>
            <dl className="mt-4 space-y-4">
              {TECHNIQUES.map(([t, d]) => (<div key={t}><dt className="font-medium">{t}</dt><dd className="text-sm text-muted">{d}</dd></div>))}
            </dl>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Sit the exam like the exam</h2>
            <dl className="mt-4 space-y-4">
              {STRATEGY.map(([t, d]) => (<div key={t}><dt className="font-medium">{t}</dt><dd className="text-sm text-muted">{d}</dd></div>))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-line px-4 py-6 text-sm text-muted sm:px-6">Musubi · 結 “to tie, to bind, to connect”</footer>
    </div>
  );
}
