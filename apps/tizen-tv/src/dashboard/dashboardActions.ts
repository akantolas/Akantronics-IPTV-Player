import { contentService } from "../data/contentService.js";
import { playerSessionFromEntry } from "../data/resumePlayback.js";
import { isInProgress, seriesEpisodeId, watchHistoryStore, type WatchEntry } from "../data/watchHistory.js";
import type { DetailContext, PlayerSession } from "../types/global.js";

export interface DashboardActionHost {
  openLiveSession(
    streamId: number,
    title: string,
    imageUrl?: string,
    categoryId?: string,
  ): Promise<void>;
  openDetail(detail: DetailContext): void;
  openPlayer(session: PlayerSession): void;
  playEntryWithSeriesInfo(entry: WatchEntry): Promise<void>;
  navigateLive(): void;
}

async function playNextEpisodeFromCard(
  card: HTMLElement,
  entry: WatchEntry,
  host: DashboardActionHost,
): Promise<void> {
  const seriesId = entry.seriesId ?? Number(card.dataset.seriesId);
  const nextId = card.dataset.nextEpisodeId;
  if (!seriesId || !nextId) return;

  const season = Number(card.dataset.nextEpisodeSeason);
  const episodeNum = Number(card.dataset.nextEpisodeNum);
  const title = card.dataset.nextEpisodeTitle ?? entry.title;
  const extension = card.dataset.nextEpisodeExtension || "mp4";
  const subtitle =
    Number.isFinite(season) && Number.isFinite(episodeNum)
      ? `S${season} E${episodeNum}`
      : entry.subtitle;

  const info = await contentService.getSeriesInfo(seriesId);
  const session: PlayerSession = {
    url: contentService.buildEpisodeUrl(nextId, extension),
    title,
    subtitle,
    watchId: seriesEpisodeId(seriesId, nextId),
    watchType: "SERIES_EPISODE",
    streamId: nextId,
    containerExtension: extension,
    seriesId,
    season: Number.isFinite(season) ? season : undefined,
    episodeId: nextId,
    imageUrl: entry.imageUrl,
    seriesInfo: info,
    fallbackUrls: contentService.buildEpisodeFallbackUrls(nextId, extension),
  };
  host.openPlayer(session);
}

export async function handleDashboardCardClick(
  card: HTMLElement,
  host: DashboardActionHost,
): Promise<void> {
  const kind = card.dataset.cardKind;
  if (kind === "history") {
    const entryId = card.dataset.entryId ?? "";
    const entry = watchHistoryStore.getEntry(entryId);
    if (!entry) return;
    if (entry.type === "LIVE") {
      await host.openLiveSession(Number(entry.streamId), entry.title, entry.imageUrl, entry.categoryId);
      return;
    }
    if (entry.type === "SERIES_EPISODE") {
      const seriesAction = card.dataset.seriesAction;
      if (seriesAction === "next") {
        await playNextEpisodeFromCard(card, entry, host);
        return;
      }
      if (seriesAction === "done") {
        if (!entry.seriesId) return;
        const info = await contentService.getSeriesInfo(entry.seriesId);
        host.openDetail({
          kind: "series",
          id: entry.seriesId,
          title: info.info.name,
          imageUrl: info.info.cover,
          seriesInfo: info,
        });
        return;
      }
      if (isInProgress(entry) || seriesAction === "resume") {
        await host.playEntryWithSeriesInfo(entry);
        return;
      }
    }
    if (!isInProgress(entry)) {
      if (entry.type === "MOVIE") {
        host.openDetail({
          kind: "movie",
          id: Number(entry.streamId),
          title: entry.title,
          imageUrl: entry.imageUrl,
          extension: entry.containerExtension,
        });
        return;
      }
    }
    await host.playEntryWithSeriesInfo(entry);
    return;
  }

  if (kind === "live") {
    const streamId = Number(card.dataset.liveId);
    if (!Number.isFinite(streamId)) return;
    const title = card.querySelector(".card-title")?.textContent?.trim() ?? "Live";
    await host.openLiveSession(
      streamId,
      title,
      card.querySelector("img")?.getAttribute("src") ?? undefined,
      card.dataset.categoryId,
    );
    return;
  }

  if (kind === "movie") {
    const id = Number(card.dataset.movieId);
    if (!Number.isFinite(id)) return;
    host.openDetail({
      kind: "movie",
      id,
      title: card.querySelector(".card-title")?.textContent?.trim() ?? "Ταινία",
      imageUrl: card.querySelector("img")?.getAttribute("src") ?? undefined,
      extension: card.dataset.extension || "mp4",
    });
    return;
  }

  if (kind === "series") {
    const id = Number(card.dataset.seriesId);
    if (!Number.isFinite(id)) return;
    const info = await contentService.getSeriesInfo(id);
    host.openDetail({
      kind: "series",
      id,
      title: info.info.name,
      imageUrl: info.info.cover,
      seriesInfo: info,
    });
  }
}

export function bindDashboardCards(root: ParentNode, host: DashboardActionHost): void {
  root.querySelectorAll<HTMLElement>(".poster-card[data-card-kind]").forEach((card) => {
    card.addEventListener("click", () => {
      void handleDashboardCardClick(card, host);
    });
  });
}

export async function playHeroEntry(
  data: {
    heroEntry: WatchEntry | null;
    quickPlayStreamId?: number;
    quickPlayTitle?: string;
    quickPlayImage?: string;
    quickPlayCategoryId?: string;
  },
  host: DashboardActionHost,
): Promise<void> {
  if (data.heroEntry && isInProgress(data.heroEntry)) {
    await host.playEntryWithSeriesInfo(data.heroEntry);
    return;
  }
  if (data.quickPlayStreamId) {
    await host.openLiveSession(
      data.quickPlayStreamId,
      data.quickPlayTitle ?? "Live",
      data.quickPlayImage,
      data.quickPlayCategoryId,
    );
    return;
  }
  host.navigateLive();
}
