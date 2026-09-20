import { analyzeImageWithOpenCV, type ImageAnalysis } from "./imageAnalysis";
import { searchPublicBlueprints, type BlueprintReference } from "./imageSearch";
import { safeFetch } from "./safeFetch";

export type BlueprintSheetKind = "floor-plan" | "site-plan" | "elevation" | "section" | "unknown";

export type BlueprintSheetAnalysis = BlueprintReference & {
  kind: BlueprintSheetKind;
  analysis?: ImageAnalysis;
  retrievalStatus: "analyzed" | "unavailable" | "skipped";
};

function classifyBlueprint(title: string): BlueprintSheetKind {
  if (/\b(elevation|facade|façade|front|side view)\b/i.test(title)) return "elevation";
  if (/\b(section|cross section|longitudinal)\b/i.test(title)) return "section";
  if (/\b(site|plot|campus|location plan)\b/i.test(title)) return "site-plan";
  if (/\b(floor|ground|level|plan view|blueprint|building plan)\b/i.test(title)) return "floor-plan";
  return "unknown";
}

async function rerankWithLocalModel<T extends { title: string }>(references: T[]): Promise<T[]> {
  const endpoint = process.env.LOCAL_MODEL_URL;
  if (!endpoint || references.length < 2) return references;
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.LOCAL_MODEL_NAME ?? "llama3.2:3b",
        stream: false,
        format: "json",
        prompt: [
          "Rank these image titles for use as architectural blueprint evidence.",
          "Prefer floor plans, site plans, elevations, sections, and schematics. Return JSON only: {\"order\":[numbers]}",
          JSON.stringify(references.map((reference, index) => ({ index, title: reference.title }))),
        ].join("\n"),
      }),
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return references;
    const data = (await response.json()) as { response?: string };
    const order = JSON.parse(data.response ?? "{}").order as unknown;
    if (!Array.isArray(order)) return references;
    const ranked = order
      .filter((index): index is number => Number.isInteger(index) && index >= 0 && index < references.length)
      .map((index) => references[index]);
    return ranked.length === references.length ? ranked : references;
  } catch {
    return references;
  }
}

/** Retrieve and analyze every public blueprint sheet we can find. This is
 * deliberately a small, auditable RAG step: search metadata from open
 * collections, retrieve the original image, then enrich each result with
 * OpenCV geometry before it reaches reconstruction. */
export async function retrieveAndAnalyzeBlueprints(
  placeQuery: string,
  buildingType?: string,
  limit = 10
): Promise<BlueprintSheetAnalysis[]> {
  const references = await rerankWithLocalModel(await searchPublicBlueprints(placeQuery, limit, buildingType));
  const sheets: BlueprintSheetAnalysis[] = [];

  for (const reference of references) {
    const kind = classifyBlueprint(reference.title);
    if (!reference.url || !["image/jpeg", "image/png", "image/webp", undefined].includes(reference.mimeType)) {
      sheets.push({ ...reference, kind, retrievalStatus: "skipped" });
      continue;
    }
    try {
      const response = await safeFetch(reference.url);
      const analysis = await analyzeImageWithOpenCV(Buffer.from(await response.arrayBuffer()));
      sheets.push({ ...reference, kind, analysis, retrievalStatus: "analyzed" });
    } catch {
      sheets.push({ ...reference, kind, retrievalStatus: "unavailable" });
    }
  }

  return sheets;
}

export function blueprintGeometryForModel(sheets: BlueprintSheetAnalysis[]) {
  return sheets
    .filter((sheet) => sheet.analysis?.largestContourPoints.length)
    .map((sheet) => ({
      title: sheet.title,
      kind: sheet.kind,
      width: sheet.analysis?.width,
      height: sheet.analysis?.height,
      corners: sheet.analysis?.largestContourPoints.length,
      normalizedContour: sheet.analysis?.largestContourPoints,
    }));
}
