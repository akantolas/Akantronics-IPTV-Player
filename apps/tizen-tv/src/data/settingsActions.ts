import { catalogIndex } from "./catalogIndex.js";
import { contentService } from "./contentService.js";
import { invalidateDashboardCache } from "../dashboard/dashboardCache.js";
import { invalidateSeriesInfoCache } from "./seriesProgress.js";
import { userSyncManager } from "../sync/userSyncManager.js";
import { activeCredentials } from "../sync/types.js";

export async function reloadActivePlaylist(): Promise<void> {
  const creds = activeCredentials(userSyncManager.loadPlaylists());
  if (!creds) {
    throw new Error("Δεν υπάρχει ενεργή playlist.");
  }
  await contentService.authenticate(creds);
  await contentService.healthCheck();
  contentService.clearCache();
  contentService.clearEpgCache();
  catalogIndex.invalidate();
  invalidateDashboardCache();
  invalidateSeriesInfoCache();
  await catalogIndex.rebuild();
}
