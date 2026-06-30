import { NextResponse } from "next/server";

// Edge-safe sha256, matches lib/auth.js sessionToken().
async function sessionToken() {
  const data = new TextEncoder().encode(
    `${process.env.APP_PASSWORD}:${process.env.AUTH_SECRET}`
  );
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Telegram posts here with its own secret header, so it skips the cookie gate.
  if (pathname.startsWith("/api/telegram")) return NextResponse.next();
  // Public paths.
  if (pathname.startsWith("/login") || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const expected = await sessionToken();
  const cookie = req.cookies.get("os_session")?.value;
  if (cookie && cookie === expected) return NextResponse.next();

  if (pathname.startsWith("/api")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
