import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { ROLE_INFO } from "@/lib/roles";
import { getVisitorId } from "@/lib/visitor";

const REPORT_TITLE: Record<string, string> = {
  REAL_ESTATE: "Staged Presentation Summary",
  DISASTER_RELIEF: "Disaster Claims Assessment",
  ACCESSIBILITY_AUDIT: "ADA Compliance Report",
  MEP_ENGINEER: "MEP Retrofit Clearance Report",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const visitorId = await getVisitorId();
  if (!visitorId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { visitorId } });
  const scan = await prisma.scan.findFirst({ where: { id, userId: user?.id } });
  if (!scan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const body = await pdf.embedFont(StandardFonts.Helvetica);

  const title = REPORT_TITLE[scan.role] ?? "Scan Report";
  page.drawText("Clonify", { x: 50, y: 740, size: 14, font, color: rgb(0.4, 0.4, 0.9) });
  page.drawText(title, { x: 50, y: 700, size: 22, font });
  page.drawText(ROLE_INFO[scan.role as keyof typeof ROLE_INFO]?.sdgTitle ?? "", {
    x: 50,
    y: 675,
    size: 11,
    font: body,
    color: rgb(0.3, 0.3, 0.3),
  });

  const lines = [
    `Address: ${scan.street}, ${scan.city}, ${scan.state} ${scan.country}`,
    `Coordinates: ${scan.lat ?? "n/a"}, ${scan.lng ?? "n/a"}`,
    `Status: ${scan.status}`,
    `Generated: ${new Date().toLocaleString()}`,
    "",
    "Metadata:",
    ...Object.entries(JSON.parse(scan.metadata || "{}")).map(
      ([k, v]) => `  ${k}: ${v}`
    ),
  ];

  let y = 630;
  for (const line of lines) {
    page.drawText(line, { x: 50, y, size: 11, font: body });
    y -= 18;
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="clonify-${scan.role.toLowerCase()}-${scan.id}.pdf"`,
    },
  });
}
