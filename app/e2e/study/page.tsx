import { notFound } from "next/navigation";
import { StudyClient } from "@/components/study/StudyClient";

export const dynamic = "force-dynamic";

/** Playwright-only harness (the real /study needs a Clerk session). 404s everywhere else. */
export default function E2EStudy() {
  if (process.env.E2E_NO_AUTH !== "1") notFound();
  return <StudyClient title="E2E deck" />;
}
