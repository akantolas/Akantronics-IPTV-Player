import { contentService } from "../data/contentService.js";
import {
  favoriteFromLive,
  favoriteFromMovie,
  favoriteFromSeries,
  favoritesStore,
} from "../data/favoritesStore.js";
import { parseExternalSubtitles, mergeSubtitleTracks } from "../data/subtitles.js";
import { toNowNext, epgProgressPercent } from "../data/epgUtils.js";
import {
  movieId,
  seriesEpisodeId,
  watchHistoryStore,
} from "../data/watchHistory.js";
import {
  countSeasonCompleted,
  getEpisodeWatchState,
  getMovieWatchState,
} from "../data/seriesProgress.js";
import { formatEpisodeDisplay } from "../ui/episodeFormat.js";
import { formatWatchTime } from "../ui/watchEntryFormat.js";
import type { DetailContext, PlayerSession, SubtitleTrack } from "../types/global.js";
import { formatPlayerTime } from "./player.js";
import { escapeHtml } from "../ui/focus.js";

export function renderDetailScreen(detail: DetailContext, loading = false): string {
  if (loading && detail.kind === "movie") {
    return `<section class="page detail-page"><div class="loading-inline">Φόρτωση λεπτομερειών…</div></section>`;
  }
  if (detail.kind === "series" && detail.seriesInfo) {
    return renderSeriesDetail(detail);
  }
  if (detail.kind === "live") {
    return renderLiveDetail(detail);
  }
  return renderMovieDetail(detail);
}

function renderLiveDetail(detail: DetailContext): string {
  const url = contentService.buildLiveUrl(detail.id);
  const { now, next } = toNowNext(detail.epg ?? []);
  const nowProgress = now ? epgProgressPercent(now.start, now.end) : 0;
  const fav = favoriteFromLive({
    stream_id: detail.id,
    name: detail.title,
    stream_icon: detail.imageUrl,
    category_id: detail.categoryId,
  });
  const isFav = favoritesStore.isFavorite(fav.id);
  const image = detail.imageUrl
    ? `<img class="detail-cover" src="${escapeHtml(detail.imageUrl)}" alt="" />`
    : `<div class="detail-cover placeholder">${escapeHtml(detail.title.slice(0, 1))}</div>`;

  return `
    <section class="page detail-page">
      <button class="btn ghost back-btn focusable" id="detail-back" tabindex="0">← Πίσω</button>
      <div class="detail-layout">
        ${image}
        <div class="detail-body">
          <div class="detail-header-row">
            <h1>${escapeHtml(detail.title)}</h1>
            <button
              id="detail-favorite"
              class="btn ghost favorite-btn focusable ${isFav ? "is-active" : ""}"
              data-fav-id="${escapeHtml(fav.id)}"
              data-fav-kind="LIVE"
              data-stream-id="${detail.id}"
              data-title="${escapeHtml(detail.title)}"
              data-image-url="${escapeHtml(detail.imageUrl ?? "")}"
              data-category-id="${escapeHtml(detail.categoryId ?? "")}"
              tabindex="0"
            >${isFav ? "★" : "☆"}</button>
          </div>
          ${detail.categoryLabel ? `<p class="detail-meta">${escapeHtml(detail.categoryLabel)}</p>` : ""}
          <p class="detail-meta">Live TV</p>
          <div class="epg-panel">
            ${
              detail.epgLoaded
                ? now
                  ? `<div class="epg-now">
                      <span class="live-badge">Τώρα</span>
                      <strong>${escapeHtml(now.title)}</strong>
                      <div class="progress-track"><div class="progress-fill" style="width: ${nowProgress}%"></div></div>
                      ${next ? `<p class="hint">Μετά: ${escapeHtml(next.title)}</p>` : ""}
                    </div>`
                  : `<p class="hint">Δεν υπάρχει διαθέσιμο EPG για αυτό το κανάλι.</p>`
                : `<p class="hint">Φόρτωση EPG…</p>`
            }
          </div>
          <button
            id="detail-play"
            class="btn primary focusable"
            data-url="${escapeHtml(url)}"
            data-title="${escapeHtml(detail.title)}"
            data-watch-type="LIVE"
            data-watch-id="live_${detail.id}"
            data-stream-id="${detail.id}"
            data-image-url="${escapeHtml(detail.imageUrl ?? "")}"
            data-category-id="${escapeHtml(detail.categoryId ?? "")}"
            data-fallback-urls="${escapeHtml(JSON.stringify(contentService.buildLiveFallbackUrls(detail.id)))}"
            data-resume-ms="0"
            tabindex="0"
          >Παρακολούθηση</button>
        </div>
      </div>
    </section>
  `;
}

function renderMovieDetail(detail: DetailContext): string {
  const info = detail.vodInfo?.info;
  const extension = detail.extension ?? detail.vodInfo?.movie_data?.container_extension ?? "mp4";
  const url = contentService.buildMovieUrl(detail.id, extension);
  const title = info?.name ?? detail.title;
  const imageUrl = info?.cover_big ?? info?.movie_image ?? detail.imageUrl;
  const watchId = movieId(detail.id);
  const saved = watchHistoryStore.getEntry(watchId);
  const { state, progress, resumeMs } = getMovieWatchState(saved);
  const playLabel = state === "in_progress" ? "Συνέχεια" : state === "completed" ? "Ξανά από την αρχή" : "Αναπαραγωγή";
  const fav = favoriteFromMovie({
    stream_id: detail.id,
    name: title,
    stream_icon: imageUrl,
    container_extension: extension,
  });
  const isFav = favoritesStore.isFavorite(fav.id);
  const metaChips = [
    info?.rating ? `★ ${info.rating}` : "",
    info?.genre,
    info?.releasedate ?? info?.release_date,
    info?.duration,
  ]
    .filter(Boolean)
    .map((chip) => `<span class="meta-chip">${escapeHtml(String(chip))}</span>`)
    .join("");

  const coverStateClass =
    state === "in_progress"
      ? " detail-cover-wrap--in-progress"
      : state === "completed"
        ? " detail-cover-wrap--completed"
        : "";

  const statusIcon =
    state === "completed"
      ? `<span class="detail-cover-wrap__status" aria-hidden="true">✓</span>`
      : state === "in_progress"
        ? `<span class="detail-cover-wrap__status detail-cover-wrap__status--progress" aria-hidden="true">▶</span>`
        : "";

  const coverProgress =
    state === "in_progress" && progress > 0
      ? `<div class="progress-track detail-cover-wrap__progress"><div class="progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>`
      : "";

  let watchMeta = "";
  if (state === "in_progress") {
    watchMeta = `<p class="detail-watch-meta">Συνέχεια · ${formatWatchTime(resumeMs)}</p>`;
  } else if (state === "completed") {
    watchMeta = `<p class="detail-watch-meta detail-watch-meta--completed">Ολοκληρώθηκε</p>`;
  }

  const backdrop = imageUrl ? `<div class="detail-backdrop"><img src="${escapeHtml(imageUrl)}" alt="" /></div>` : "";
  const image = imageUrl
    ? `<div class="detail-cover-wrap${coverStateClass}">
        <img class="detail-cover" src="${escapeHtml(imageUrl)}" alt="" />
        ${statusIcon}
        ${coverProgress}
      </div>`
    : `<div class="detail-cover placeholder">${escapeHtml(title.slice(0, 1))}</div>`;
  const plot = info?.plot ?? info?.description;

  return `
    <section class="page detail-page">
      ${backdrop}
      <button class="btn ghost back-btn focusable" id="detail-back" tabindex="0">← Πίσω</button>
      <div class="detail-layout">
        ${image}
        <div class="detail-body">
          <div class="detail-header-row">
            <h1>${escapeHtml(title)}</h1>
            <button
              id="detail-favorite"
              class="btn ghost favorite-btn focusable ${isFav ? "is-active" : ""}"
              data-fav-id="${escapeHtml(fav.id)}"
              data-fav-kind="MOVIE"
              data-stream-id="${detail.id}"
              data-title="${escapeHtml(title)}"
              data-image-url="${escapeHtml(imageUrl ?? "")}"
              data-extension="${escapeHtml(extension)}"
              tabindex="0"
            >${isFav ? "★" : "☆"}</button>
          </div>
          ${metaChips ? `<div class="meta-chips">${metaChips}</div>` : ""}
          ${info?.director ? `<p class="detail-meta"><strong>Σκηνοθέτης:</strong> ${escapeHtml(info.director)}</p>` : ""}
          ${info?.cast ? `<p class="detail-meta"><strong>Ηθοποιοί:</strong> ${escapeHtml(info.cast)}</p>` : ""}
          ${plot ? `<p class="plot">${escapeHtml(plot)}</p>` : ""}
          ${watchMeta}
          <button
            id="detail-play"
            class="btn primary focusable"
            data-url="${escapeHtml(url)}"
            data-title="${escapeHtml(title)}"
            data-watch-id="${escapeHtml(watchId)}"
            data-watch-type="MOVIE"
            data-stream-id="${detail.id}"
          data-extension="${escapeHtml(extension)}"
          data-image-url="${escapeHtml(imageUrl ?? "")}"
          data-fallback-urls="${escapeHtml(JSON.stringify(contentService.buildMovieFallbackUrls(detail.id, extension)))}"
          data-resume-ms="${resumeMs}"
            tabindex="0"
          >${playLabel}</button>
        </div>
      </div>
      ${renderResumeDialog(resumeMs)}
    </section>
  `;
}

function renderEpisodeRow(
  detail: DetailContext,
  season: string,
  ep: import("@tv/xtream-core").SeriesEpisode,
  seriesName: string,
  seriesCover: string,
): string {
  const url = contentService.buildEpisodeUrl(ep.id, ep.container_extension);
  const watchId = seriesEpisodeId(detail.id, ep.id);
  const saved = watchHistoryStore.getEntry(watchId);
  const { state, progress, resumeMs } = getEpisodeWatchState(saved);
  const display = formatEpisodeDisplay(ep, season, seriesName);
  const thumbUrl = ep.info?.movie_image || seriesCover;

  const stateClass =
    state === "in_progress"
      ? " episode-card--in-progress"
      : state === "completed"
        ? " episode-card--completed"
        : "";

  let meta = "";
  if (state === "in_progress") {
    meta = `<span class="episode-card__meta">Συνέχεια · ${formatWatchTime(resumeMs)}</span>`;
  } else if (state === "completed") {
    meta = `<span class="episode-card__meta">Ολοκληρώθηκε</span>`;
  }

  const episodeProgress =
    state === "in_progress" && progress > 0
      ? `<div class="progress-track episode-card__progress"><div class="progress-fill" style="width:${Math.round(progress * 100)}%"></div></div>`
      : "";

  const statusIcon =
    state === "completed"
      ? `<span class="episode-card__status" aria-hidden="true">✓</span>`
      : state === "in_progress"
        ? `<span class="episode-card__status episode-card__status--progress" aria-hidden="true">▶</span>`
        : "";

  return `
    <button
      class="episode-btn episode-card focusable${stateClass}"
      data-url="${escapeHtml(url)}"
      data-title="${escapeHtml(display.title)}"
      data-subtitle="${escapeHtml(`S${season} E${ep.episode_num}`)}"
      data-watch-id="${escapeHtml(watchId)}"
      data-watch-type="SERIES_EPISODE"
      data-stream-id="${escapeHtml(ep.id)}"
      data-extension="${escapeHtml(ep.container_extension)}"
      data-series-id="${detail.id}"
      data-season="${season}"
      data-episode-id="${escapeHtml(ep.id)}"
      data-image-url="${escapeHtml(seriesCover)}"
      data-fallback-urls="${escapeHtml(JSON.stringify(contentService.buildEpisodeFallbackUrls(ep.id, ep.container_extension)))}"
      data-resume-ms="${resumeMs}"
      tabindex="0"
    >
      <div class="episode-card__media">
        <img src="${escapeHtml(thumbUrl)}" alt="" />
        ${statusIcon}
        ${episodeProgress}
      </div>
      <div class="episode-card__body">
        <span class="episode-card__title">${escapeHtml(display.headline)}</span>
        ${meta}
      </div>
    </button>
  `;
}

function renderSeriesDetail(detail: DetailContext): string {
  const info = detail.seriesInfo!;
  const seriesName = info.info.name;
  const favId = favoriteFromSeries({
    series_id: detail.id,
    name: seriesName,
    cover: info.info.cover,
  }).id;
  const isFav = favoritesStore.isFavorite(favId);

  const seasons = Object.keys(info.episodes).sort((a, b) => Number(a) - Number(b));
  const activeSeason =
    detail.activeSeason && seasons.includes(detail.activeSeason)
      ? detail.activeSeason
      : seasons[0] ?? "1";
  const seasonTabs = seasons
    .map((season) => {
      const items = info.episodes[season] ?? [];
      const completed = countSeasonCompleted(
        detail.id,
        items,
        (id) => watchHistoryStore.getEntry(id),
        seriesEpisodeId,
      );
      const label =
        items.length > 0 ? `Σ${season} · ${completed}/${items.length}` : `Σ${season}`;
      return `<button class="season-tab focusable ${season === activeSeason ? "is-active" : ""}" data-season-tab="${season}" tabindex="0">${escapeHtml(label)}</button>`;
    })
    .join("");

  const episodePanels = seasons
    .map((season) => {
      const items = info.episodes[season] ?? [];
      const buttons = items
        .map((ep) => renderEpisodeRow(detail, season, ep, seriesName, info.info.cover))
        .join("");
      return `<div class="season-panel ${season === activeSeason ? "" : "hidden"}" data-season-panel="${season}">${buttons}</div>`;
    })
    .join("");

  const backdrop = info.info.cover
    ? `<div class="detail-backdrop"><img src="${escapeHtml(info.info.cover)}" alt="" /></div>`
    : "";
  const image = info.info.cover
    ? `<img class="detail-cover" src="${escapeHtml(info.info.cover)}" alt="" />`
    : `<div class="detail-cover placeholder">${escapeHtml(info.info.name.slice(0, 1))}</div>`;

  return `
    <section class="page detail-page">
      ${backdrop}
      <button class="btn ghost back-btn focusable" id="detail-back" tabindex="0">← Πίσω</button>
      <div class="detail-layout">
        ${image}
        <div class="detail-body">
          <div class="detail-header-row">
            <h1>${escapeHtml(info.info.name)}</h1>
            <button
              id="detail-favorite"
              class="btn ghost favorite-btn focusable ${isFav ? "is-active" : ""}"
              data-fav-id="${escapeHtml(favId)}"
              data-fav-kind="SERIES"
              data-series-id="${detail.id}"
              data-title="${escapeHtml(info.info.name)}"
              data-image-url="${escapeHtml(info.info.cover ?? "")}"
              tabindex="0"
            >${isFav ? "★" : "☆"}</button>
          </div>
          ${info.info.plot ? `<p class="plot">${escapeHtml(info.info.plot)}</p>` : ""}
          <div class="season-tabs">${seasonTabs}</div>
          <div class="episode-list">${episodePanels}</div>
        </div>
      </div>
      ${renderResumeDialog(0)}
    </section>
  `;
}

function renderResumeDialog(resumeMs: number): string {
  const resumeHint =
    resumeMs > 0 ? `Συνέχεια από ${formatPlayerTime(resumeMs)}` : "Βρέθηκε αποθηκευμένη πρόοδος.";
  return `
    <div id="resume-dialog" class="modal hidden" role="dialog" aria-modal="true">
      <div class="modal-card">
        <h2>Συνέχεια παρακολούθησης;</h2>
        <p class="hint">${escapeHtml(resumeHint)}</p>
        <div class="modal-actions">
          <button id="resume-continue" class="btn primary focusable" tabindex="0">Συνέχεια</button>
          <button id="resume-start-over" class="btn ghost focusable" tabindex="0">Από την αρχή</button>
          <button id="resume-cancel" class="btn ghost focusable" tabindex="0">Ακύρωση</button>
        </div>
      </div>
    </div>
  `;
}

export function subtitleTracksFromVod(detail: DetailContext): SubtitleTrack[] {
  const parsed = parseExternalSubtitles(detail.vodInfo?.info?.subtitles);
  return mergeSubtitleTracks(parsed);
}

export function playerSessionFromButton(button: HTMLElement, fromBeginning = false): PlayerSession | null {
  const url = button.dataset.url;
  const title = button.dataset.title;
  if (!url || !title) return null;
  const resumeMs = fromBeginning ? 0 : Number(button.dataset.resumeMs ?? 0);
  let subtitleTracks: SubtitleTrack[] | undefined;
  try {
    subtitleTracks = button.dataset.subtitleTracks ? (JSON.parse(button.dataset.subtitleTracks) as SubtitleTrack[]) : undefined;
  } catch {
    subtitleTracks = undefined;
  }
  let fallbackUrls: string[] | undefined;
  try {
    fallbackUrls = button.dataset.fallbackUrls ? (JSON.parse(button.dataset.fallbackUrls) as string[]) : undefined;
  } catch {
    fallbackUrls = undefined;
  }
  return {
    url,
    title,
    subtitle: button.dataset.subtitle,
    watchId: button.dataset.watchId,
    watchType: button.dataset.watchType as PlayerSession["watchType"],
    startPositionMs: resumeMs,
    streamId: button.dataset.streamId,
    containerExtension: button.dataset.extension,
    seriesId: button.dataset.seriesId ? Number(button.dataset.seriesId) : undefined,
    season: button.dataset.season ? Number(button.dataset.season) : undefined,
    episodeId: button.dataset.episodeId,
    imageUrl: button.dataset.imageUrl,
    subtitleTracks,
    fallbackUrls,
    seriesInfo: button.dataset.seriesInfo ? (JSON.parse(button.dataset.seriesInfo) as import("@tv/xtream-core").SeriesInfo) : undefined,
    liveCategoryId: button.dataset.categoryId,
  };
}

