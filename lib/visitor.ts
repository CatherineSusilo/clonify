import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "./prisma";

const COOKIE_NAME = "visitorId";

/** Reads the visitorId cookie without creating one (Server Components can't set cookies). */
export async function getVisitorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Reads or creates the visitorId cookie. Only callable from a Route Handler or Server Action. */
export async function ensureVisitorId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const id = randomUUID();
  store.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return id;
}

export async function getCurrentUser() {
  const visitorId = await getVisitorId();
  if (!visitorId) return null;
  return prisma.user.findUnique({
    where: { visitorId },
    include: { subscription: true },
  });
}
