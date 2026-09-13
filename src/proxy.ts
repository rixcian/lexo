import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/cookie";

/** Reachable without an account. Everything else needs one. */
const PUBLIC = ["/login", "/register", "/offline"];

/** The container health check must answer before anyone has registered. */
const PUBLIC_API = ["/api/health"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC.includes(pathname) ||
    PUBLIC_API.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  );
}

/**
 * An optimistic gate: it only looks at whether a session cookie exists, never
 * at the database, because this runs on every navigation including prefetches.
 * `requireUser()` in the data layer is what actually decides.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (isPublic(pathname)) {
    // A cookie in hand means the sign-in screen has nothing to offer.
    // Registration stays open: that is how the second person is added, and
    // whoever does it is signed in at the time.
    if (signedIn && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.nextUrl));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    // An API answers; only a page can be sent somewhere. It also keeps the
    // service worker from caching a login page under a media URL.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  // Skips the build output, the installable-app files and the icons, all of
  // which the browser fetches before there is any chance of a session.
  matcher: [
    "/((?!_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico).*)",
  ],
};
