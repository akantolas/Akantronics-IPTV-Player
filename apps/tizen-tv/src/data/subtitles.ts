import type { ExternalSubtitleRef } from "@tv/xtream-core";

export function parseExternalSubtitles(raw: unknown): ExternalSubtitleRef[] {
  if (!Array.isArray(raw)) return [];
  const results: ExternalSubtitleRef[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const obj = item as Record<string, unknown>;
      const url = String(obj.url ?? obj.path ?? obj.file ?? obj.src ?? "").trim();
      if (!url.startsWith("http")) continue;
      const language = String(obj.language ?? obj.lang ?? obj.code ?? "").trim();
      const name = String(obj.name ?? obj.title ?? obj.label ?? "").trim();
      results.push({
        url,
        label: name || language || "Υπότιτλοι",
        language: language || undefined,
      });
      continue;
    }
    if (typeof item === "string" && item.startsWith("http")) {
      results.push({ url: item, label: "Υπότιτλοι" });
    }
  }
  return results;
}
