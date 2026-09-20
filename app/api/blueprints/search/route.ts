import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { retrieveAndAnalyzeBlueprints } from "@/lib/blueprintPipeline";

export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const url = new URL(request.url);
  const place = url.searchParams.get("place")?.trim();
  const buildingType = url.searchParams.get("buildingType")?.trim() || "other";
  if (!place) return NextResponse.json({ error: "A place name or address is required." }, { status: 400 });

  try {
    const sheets = await retrieveAndAnalyzeBlueprints(place, buildingType, 10);
    return NextResponse.json({
      query: place,
      buildingType,
      sheets,
      modelGeometry: sheets
        .filter((sheet) => sheet.analysis?.largestContourPoints.length)
        .map((sheet) => ({ title: sheet.title, kind: sheet.kind, corners: sheet.analysis?.largestContourPoints.length })),
    });
  } catch (error) {
    console.error("[blueprints] Search failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Blueprint retrieval failed." }, { status: 502 });
  }
}
