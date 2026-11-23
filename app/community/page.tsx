import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { facets, listPosts } from "@/server/community";

export const dynamic = "force-dynamic";
export const metadata = { title: "Community · Musubi" };

type SP = { q?: string; track?: string; subject?: string; sort?: string };

export default async function CommunityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const userId = await auth().then((a) => a.userId).catch(() => null); // public page: signed-out (or no middleware) is fine
  const sort = sp.sort === "new" || sp.sort === "verified" ? sp.sort : "top";
  const [posts, f] = await Promise.all([listPosts({ q: sp.q, track: sp.track, subject: sp.subject, sort }), facets()]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl text-seal">結</span> Musubi</Link>
        <nav className="ml-auto flex items-center gap-3 text-sm">
          <Link href={userId ? "/dashboard" : "/sign-in"} className="rounded-lg px-3 py-2 hover:bg-card">{userId ? "Dashboard" : "Sign in"}</Link>
        </nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <h1 className="text-xl font-semibold">Community decks</h1>
            <p className="text-sm text-muted">Peer-written questions with real item statistics. Fork one into your library and keep studying.</p>
          </div>
          <form method="get" className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
            <label className="sr-only" htmlFor="q">Search decks</label>
            <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Search title, topic, subject" className="min-h-11 min-w-0 rounded-lg border border-line bg-card px-3 text-sm" />
            <label className="sr-only" htmlFor="track">Exam track</label>
            <select id="track" name="track" defaultValue={sp.track ?? ""} className="min-h-11 rounded-lg border border-line bg-card px-2 text-sm">
              <option value="">All tracks</option>{f.tracks.map((t) => <option key={t}>{t}</option>)}
            </select>
            <label className="sr-only" htmlFor="sort">Sort</label>
            <select id="sort" name="sort" defaultValue={sort} className="min-h-11 rounded-lg border border-line bg-card px-2 text-sm">
              <option value="top">Top rated</option><option value="new">Newest</option><option value="verified">Verified only</option>
            </select>
            <button className="min-h-11 rounded-lg bg-ink px-4 text-sm font-medium text-paper">Search</button>
          </form>

          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">Nothing here yet. Publish one of your decks from the dashboard to start the library.</div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link href={`/community/${p.id}`} className="block h-full rounded-xl border border-line bg-card p-4 hover:border-ink">
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 break-words font-medium">{p.title}</h2>
                      {p.verified && <span className="shrink-0 rounded-sm bg-sage px-1.5 py-0.5 text-[11px] font-medium text-paper">Verified</span>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description || p.topic || "No description."}</p>
                    <p className="mt-2 text-xs text-muted tabular-nums">{p.track}{p.subject ? ` · ${p.subject}` : ""} · {p.items} items · {p.score >= 0 ? "+" : ""}{p.score} · by {p.publisher ?? "anonymous"}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
