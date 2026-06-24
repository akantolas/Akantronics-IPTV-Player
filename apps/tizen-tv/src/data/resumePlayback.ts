import { contentService } from "./contentService.js";
import {
  isInProgress,
  resolveResumeMs,
  type WatchEntry,
} from "./watchHistory.js";
import type { PlayerSession } from "../types/global.js";

export function playerSessionFromEntry(entry: WatchEntry): PlayerSession | null {
  if (entry.type === "LIVE") {
    const streamId = Number(entry.streamId);
    if (!Number.isFinite(streamId)) return null;
    return {
      url: contentService.buildLiveUrl(streamId),
      title: entry.title,
      watchId: entry.id,
      watchType: "LIVE",
      streamId: entry.streamId,
      imageUrl: entry.imageUrl,
    };
  }

  if (entry.type === "MOVIE") {
    const streamId = Number(entry.streamId);
    if (!Number.isFinite(streamId)) return null;
    const resumeMs = resolveResumeMs(entry);
    return {
      url: contentService.buildMovieUrl(streamId, entry.containerExtension ?? "mp4"),
      title: entry.title,
      watchId: entry.id,
      watchType: "MOVIE",
      startPositionMs: resumeMs,
      streamId: entry.streamId,
      containerExtension: entry.containerExtension,
      imageUrl: entry.imageUrl,
    };
  }

  if (entry.type === "SERIES_EPISODE" && entry.seriesId != null && entry.episodeId) {
    const resumeMs = resolveResumeMs(entry);
    return {
      url: contentService.buildEpisodeUrl(entry.episodeId, entry.containerExtension ?? "mp4"),
      title: entry.title,
      subtitle: entry.subtitle,
      watchId: entry.id,
      watchType: "SERIES_EPISODE",
      startPositionMs: resumeMs,
      streamId: entry.streamId,
      containerExtension: entry.containerExtension,
      seriesId: entry.seriesId,
      season: entry.season ?? undefined,
      episodeId: entry.episodeId,
      imageUrl: entry.imageUrl,
    };
  }

  return null;
}
