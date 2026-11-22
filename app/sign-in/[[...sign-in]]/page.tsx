import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex h-dvh w-full items-center justify-center overflow-hidden px-4">
      <SignIn />
    </main>
  );
}
