import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Everything is behind a login except the sign-in pages themselves and the
 * scheduled job, which carries its own secret rather than a session.
 *
 * This lives at src/proxy.ts and nowhere else. Next 16 renamed the middleware
 * convention to "proxy", and with the app under src/ the file has to sit
 * beside it: at the repository root it is silently never run, which shows up
 * as every page failing rather than as anything about a misplaced file.
 */
const isOpen = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isOpen(request)) return;

  // Send a signed-out visitor to the sign-in page. auth.protect() would
  // rewrite to a 404 instead, which reads as a broken deployment.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: request.url });
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
