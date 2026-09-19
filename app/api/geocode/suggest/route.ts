import { NextResponse } from "next/server";
import { suggestAddresses } from "@/lib/geocode";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  try {
    const suggestions = await suggestAddresses(q);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
