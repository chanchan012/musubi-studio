import { currentUserId } from "@/server/identity";
import { redirect } from "next/navigation";
import { StudyClient } from "@/components/study/StudyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Study · Musubi" };

export default async function StudyAll() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  return <StudyClient title="All decks" />;
}
