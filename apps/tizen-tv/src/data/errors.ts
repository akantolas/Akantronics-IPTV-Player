export function userMessage(error: unknown, fallback = "Κάτι πήγε στραβά."): string {
  const raw = error instanceof Error ? error.message : String(error || "");
  const message = raw.toLowerCase();
  if (message.includes("invalid username") || message.includes("password")) {
    return "Λάθος username ή password.";
  }
  if (message.includes("cannot reach") || message.includes("failed to fetch") || message.includes("network")) {
    return "Δεν υπάρχει σύνδεση με τον IPTV server. Έλεγξε URL, θύρα και δίκτυο.";
  }
  if (message.includes("http 401") || message.includes("http 403")) {
    return "Ο IPTV server απέρριψε τα credentials ή η συνδρομή δεν είναι ενεργή.";
  }
  if (message.includes("http 404")) {
    return "Το περιεχόμενο δεν βρέθηκε στον IPTV server.";
  }
  if (message.includes("http 5")) {
    return "Ο IPTV server έχει προσωρινό πρόβλημα. Δοκίμασε ξανά.";
  }
  if (message.includes("avplay") || message.includes("playback") || message.includes("prepare")) {
    return "Το stream δεν υποστηρίζεται ή δεν μπορεί να ξεκινήσει στην TV.";
  }
  return raw || fallback;
}
