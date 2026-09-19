import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? toPublicUser(user) : null });
}

const bodySchema = z.object({
  role: z.enum(ROLES),
  unitPreference: z.enum(["IMPERIAL", "METRIC"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { role, unitPreference } = parsed.data;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role, unitPreference },
  });

  return NextResponse.json({ user: toPublicUser({ ...user, ...updated }) });
}
