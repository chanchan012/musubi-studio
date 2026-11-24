import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtected = createRouteMatcher(["/dashboard(.*)", "/studio(.*)", "/exam(.*)", "/study(.*)"]);
const isPublicApi = createRouteMatcher(["/api/health"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (!isPublicApi(req) && isProtected(req)) await auth.protect();
}, {
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
});

/** E2E_NO_AUTH is only ever set by the Playwright web server (Clerk's dev handshake needs network the test box lacks). */
export default process.env.E2E_NO_AUTH === "1" ? () => NextResponse.next() : withClerk;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
