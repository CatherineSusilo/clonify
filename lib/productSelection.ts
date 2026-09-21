import type { ProductKey } from "./products";

const PRODUCT_KEYS = new Set<ProductKey>(["NAVIGATION", "SHOWCASE", "RENOVATION", "ROBOTICS"]);

export function parseProductSelections(value: string | null | undefined): ProductKey[] {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ProductKey => typeof item === "string" && PRODUCT_KEYS.has(item as ProductKey));
  } catch {
    return [];
  }
}
