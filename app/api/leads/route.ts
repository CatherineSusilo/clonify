import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  kind: z.enum(["demo-contact", "pilot"]),
  name: z.string().trim().min(2).max(120),
  email: z.string().email(),
  message: z.string().trim().min(10).max(2000),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please provide a name, valid email, and message." }, { status: 400 });
  await prisma.lead.create({ data: parsed.data });
  return NextResponse.json({ ok: true });
}
