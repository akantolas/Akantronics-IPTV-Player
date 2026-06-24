export function buildUnavatarUrl(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `https://unavatar.io/${encodeURIComponent(normalized)}`;
}

export function resolveAccountAvatarUrl(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  return buildUnavatarUrl(email);
}
