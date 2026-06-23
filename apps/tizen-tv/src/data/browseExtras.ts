import { watchHistoryStore } from "./watchHistory.js";
import { renderHistorySection } from "../ui/historyRows.js";
import type { BrowseScreen } from "./browseLoader.js";

export function renderBrowseTopRows(screen: BrowseScreen): string {
  if (screen === "live") {
    const recent = watchHistoryStore
      .getRecentlyViewed(12)
      .filter((entry) => entry.type === "LIVE");
    return renderHistorySection("Πρόσφατα Live", recent, true);
  }
  if (screen === "movies") {
    const cont = watchHistoryStore.getContinueWatching().filter((e) => e.type === "MOVIE");
    const recent = watchHistoryStore.getRecentlyViewed(12).filter((e) => e.type === "MOVIE");
    return `${renderHistorySection("Συνέχεια", cont, true, { removable: true })}${renderHistorySection("Πρόσφατες ταινίες", recent, true, { removable: true })}`;
  }
  const cont = watchHistoryStore.getContinueWatching().filter((e) => e.type === "SERIES_EPISODE");
  const recent = watchHistoryStore.getRecentlyViewed(12).filter((e) => e.type === "SERIES_EPISODE");
  return `${renderHistorySection("Συνέχεια", cont, true, { removable: true })}${renderHistorySection("Πρόσφατες σειρές", recent, true, { removable: true })}`;
}
