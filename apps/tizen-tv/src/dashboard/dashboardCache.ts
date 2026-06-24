import type { DashboardData } from "../data/dashboardService.js";

const PREVIEW_TTL_MS = 5 * 60 * 1000;

let snapshot: DashboardData | null = null;
let snapshotAt = 0;

export function getDashboardSnapshot(): DashboardData | null {
  return snapshot;
}

export function setDashboardSnapshot(data: DashboardData): void {
  snapshot = data;
  snapshotAt = Date.now();
}

export function invalidateDashboardCache(): void {
  snapshot = null;
  snapshotAt = 0;
}

export function isDashboardCacheWarm(): boolean {
  return snapshot !== null;
}

export function isDashboardCatalogStale(): boolean {
  return !snapshot || Date.now() - snapshotAt > PREVIEW_TTL_MS;
}
