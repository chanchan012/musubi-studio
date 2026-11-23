import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getPost } from "@/server/community";
import { NON_FUNCTIONING } from "@/lib/analytics";
import { PostActions } from "@/components/community/PostActions";
import { ErratumForm } from "@/components/community/ErratumForm";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const userId = await auth().then((a) => a.userId).catch(() => null); // public page: signed-out (or no middleware) is fine
  const data = await getPost(id, userId);
  if (!data) notFound();
  const { post, items, myVote } = data;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-xl text-seal">結</span> Musubi</Link>
        <nav className="ml-auto text-sm"><Link href="/community" className="rounded-lg px-3 py-2 hover:bg-card">All decks</Link></nav>
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words text-xl font-semibold">{post.title}</h1>
              {post.verified && <span className="rounded-sm bg-sage px-1.5 py-0.5 text-[11px] font-medium text-paper">Verified</span>}
            </div>
            <p className="mt-1 text-sm text-muted">{post.description}</p>
            <p className="mt-1 text-xs text-muted tabular-nums">{post.track}{post.subject ? ` · ${post.subject}` : ""}{post.topic ? ` · ${post.topic}` : ""} · {items.length} items · by {post.publisher ?? "anonymous"}</p>
            <div className="mt-3"><PostActions postId={post.id} score={post.score} myVote={myVote} signedIn={!!userId} /></div>
          </section>

          <ol className="space-y-3" aria-label="Items">
            {items.map((it, n) => (
              <li key={it.id} className="rounded-xl border border-line bg-card p-4">
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted tabular-nums">{n + 1}.</span>
                  <p className="min-w-0 flex-1 break-words text-sm">{it.kind === "mcq" ? it.stem : it.front}</p>
                  {it.authorKind === "agent" && <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[11px] text-muted">AI</span>}
                </div>
                {it.kind === "mcq" && (
                  <>
                    <p className="mt-2 text-xs text-muted tabular-nums">
                      {it.attempts === 0 ? "Not attempted yet" : <>P-value {it.p!.toFixed(2)} ({it.band}) · {it.attempts} attempts</>}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {it.options.map((o, i) => {
                        const d = it.distractors[i];
                        return (
                          <li key={i} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2 text-sm">
                            <span className="text-muted">{"ABCDE"[i]}</span>
                            <span className="min-w-0 break-words">{o}</span>
                            <span className="text-right text-xs tabular-nums">
                              {d && it.attempts > 0 ? <>{pct(d.rate)}{d.nonFunctioning && <span className="ml-1 rounded-sm border border-seal px-1 text-seal" title={`Chosen by under ${pct(NON_FUNCTIONING)} of examinees`}>weak distractor</span>}</> : ""}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                  {it.openErrata > 0 && <span className="text-seal">{it.openErrata} open erratum{it.openErrata > 1 ? "a" : ""}</span>}
                  {userId ? <ErratumForm itemId={it.id} /> : <Link href="/sign-in" className="underline">Sign in to report an error</Link>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}
