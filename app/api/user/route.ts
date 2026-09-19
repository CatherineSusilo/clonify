import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getVisitorId } from "@/lib/visitor";
import { ROLES } from "@/lib/roles";

export async function GET() {
  const visitorId = await getVisitorId();
  if (!visitorId) return NextResponse.json({ user: null });
  const user = await prisma.user.findUnique({
    where: { visitorId },
    include: { subscription: true },
  });
  return NextResponse.json({ user });
}

const bodySchema = z.object({
  role: z.enum(ROLES),
  unitPreference: z.enum(["IMPERIAL", "METRIC"]),
});

export async function POST(request: Request) {
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json({ error: "Missing visitor session" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { role, unitPreference } = parsed.data;

  const user = await prisma.user.upsert({
    where: { visitorId },
    update: { role, unitPreference },
    create: { visitorId, role, unitPreference },
  });

  return NextResponse.json({ user });
}
