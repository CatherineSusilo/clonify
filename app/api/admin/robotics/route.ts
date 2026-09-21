import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ADMIN_EMAIL } from "@/lib/products";

async function admin() {
  const user = await getCurrentUser();
  return user?.email.toLowerCase() === ADMIN_EMAIL ? user : null;
}

export async function GET() {
  const user = await getCurrentUser();
  const setting = prisma.appSetting?.findUnique
    ? await prisma.appSetting.findUnique({ where: { key: "robotics_enabled" } })
    : null;
  return NextResponse.json({ enabled: setting?.value === "true", isAdmin: user?.email.toLowerCase() === ADMIN_EMAIL });
}

export async function POST(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { enabled?: boolean } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }
  await prisma.appSetting.upsert({
    where: { key: "robotics_enabled" },
    update: { value: body.enabled ? "true" : "false" },
    create: { key: "robotics_enabled", value: body.enabled ? "true" : "false" },
  });
  return NextResponse.json({ enabled: Boolean(body.enabled) });
}
