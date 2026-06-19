import type { StreamKind, XtreamCredentials } from "./types.js";

export function normalizeServerUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return trimmed;
}

export function buildPlayerApiUrl(
  credentials: XtreamCredentials,
  action?: string,
  extraParams: Record<string, string> = {},
): string {
  const base = normalizeServerUrl(credentials.serverUrl);
  const url = new URL(`${base}/player_api.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  if (action) {
    url.searchParams.set("action", action);
  }
  for (const [key, value] of Object.entries(extraParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function buildStreamUrl(
  credentials: XtreamCredentials,
  kind: StreamKind,
  streamId: number | string,
  extension = "ts",
): string {
  const base = normalizeServerUrl(credentials.serverUrl);
  const segment =
    kind === "live" ? "live" : kind === "movie" ? "movie" : "series";
  const ext = kind === "live" ? "ts" : extension.replace(/^\./, "");
  return `${base}/${segment}/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${streamId}.${ext}`;
}

export function validateCredentials(credentials: XtreamCredentials): string[] {
  const errors: string[] = [];
  if (!credentials.serverUrl.trim()) errors.push("Server URL is required.");
  if (!credentials.username.trim()) errors.push("Username is required.");
  if (!credentials.password.trim()) errors.push("Password is required.");
  return errors;
}
