import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "session";

const PROTECTED_PREFIXES = ["/onboarding", "/scan", "/viewer", "/scans", "/account", "/checkout"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token
    ? await prisma.session.findUnique({ where: { token } })
    : null;

  if (!session || session.expiresAt < new Date()) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
