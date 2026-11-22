import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const viewport = { width: "device-width", initialScale: 1 };

export const metadata: Metadata = {
  title: "Musubi — collaborative board-exam studio",
  description: "結 Co-create flashcards and board-style MCQs with humans and AI agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
      <html lang="en"><body>{children}</body></html>
    </ClerkProvider>
  );
}
