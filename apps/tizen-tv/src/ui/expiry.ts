export type ExpiryUrgency = "unlimited" | "healthy" | "warning" | "critical" | "expired";

export interface ExpiryInfo {
  label: string;
  urgency: ExpiryUrgency;
}

export function computeExpiry(expDate: string | undefined | null): ExpiryInfo {
  if (!expDate || expDate === "0" || expDate.toLowerCase() === "null") {
    return { label: "Απεριόριστη", urgency: "unlimited" };
  }
  const timestamp = Number(expDate);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { label: expDate, urgency: "healthy" };
  }
  const expiryMs = timestamp * 1000;
  const now = Date.now();
  if (expiryMs <= now) {
    return { label: "Έληξε", urgency: "expired" };
  }
  const days = Math.floor((expiryMs - now) / 86_400_000);
  const label = formatExpiryDate(expiryMs);
  if (days <= 1) {
    return { label: days <= 0 ? "Λήγει σήμερα" : "Λήγει αύριο", urgency: "critical" };
  }
  if (days <= 7) {
    return { label: "Λήγει σύντομα", urgency: "warning" };
  }
  return { label, urgency: "healthy" };
}

export function expiryClass(urgency: ExpiryUrgency): string {
  return `expiry-${urgency}`;
}

export function expiryDisplayValue(urgency: ExpiryUrgency, label: string): string {
  if (urgency === "unlimited") return "∞";
  if (urgency === "expired") return "Έληξε";
  if (urgency === "critical") return "Σήμερα";
  if (urgency === "warning") return "Σύντομα";
  return label;
}

function formatExpiryDate(expiryMs: number): string {
  const date = new Date(expiryMs);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
