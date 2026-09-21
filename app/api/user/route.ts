import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { ADMIN_EMAIL, type ProductKey } from "@/lib/products";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? toPublicUser(user) : null });
}

const bodySchema = z.object({
  role: z.enum(ROLES),
  unitPreference: z.enum(["IMPERIAL", "METRIC"]),
  productSelections: z.array(z.enum(["NAVIGATION", "SHOWCASE", "RENOVATION", "ROBOTICS"])).min(1),
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
  const { role, unitPreference, productSelections } = parsed.data;
  const roboticsSetting = await prisma.appSetting.findUnique({ where: { key: "robotics_enabled" } });
  const roboticsAllowed = user.email.toLowerCase() === ADMIN_EMAIL || roboticsSetting?.value === "true";
  const safeProducts = productSelections.filter((product): product is ProductKey => product !== "ROBOTICS" || roboticsAllowed);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role, unitPreference, productSelections: JSON.stringify(safeProducts) },
  });

  return NextResponse.json({ user: toPublicUser({ ...user, ...updated }) });
}
