export interface ExternalSubtitleRef {
  url: string;
  label: string;
  language?: string;
}

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

export function mergeSubtitleTracks(
  external: ExternalSubtitleRef[],
  embedded: Array<{ id: string; label: string }> = [],
): Array<{ id: string; label: string; url?: string }> {
  return [
    { id: "off", label: "Ανενεργοί" },
    ...embedded,
    ...external.map((track, index) => ({ id: `ext-${index}`, label: track.label, url: track.url })),
  ];
}
