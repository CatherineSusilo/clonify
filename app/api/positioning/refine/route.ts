import { NextResponse } from "next/server";
import { refineIndoorPosition } from "@/lib/positioning";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const result = refineIndoorPosition(lat, lng);
  return NextResponse.json(result);
}
