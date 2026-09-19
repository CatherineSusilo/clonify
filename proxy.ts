import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";

const COOKIE_NAME = "visitorId";

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(COOKIE_NAME)?.value;
  if (existing) return NextResponse.next();

  const response = NextResponse.next();
  response.cookies.set(COOKIE_NAME, randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
