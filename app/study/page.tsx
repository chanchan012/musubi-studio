import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { StudyClient } from "@/components/study/StudyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Study · Musubi" };

export default async function StudyAll() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  return <StudyClient title="All decks" />;
}
