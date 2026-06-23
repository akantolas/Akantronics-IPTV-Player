import { contentService } from "../data/contentService.js";
import {
  favoriteFromLive,
  favoriteFromMovie,
  favoriteFromSeries,
  favoritesStore,
} from "../data/favoritesStore.js";
import { parseExternalSubtitles } from "../data/subtitles.js";
import {
  isInProgress,
  movieId,
  seriesEpisodeId,
  watchHistoryStore,
} from "../data/watchHistory.js";
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
          <button
            id="detail-play"
            class="btn primary focusable"
            data-url="${escapeHtml(url)}"
            data-title="${escapeHtml(detail.title)}"
            data-watch-type="LIVE"
            data-watch-id="live_${detail.id}"
            data-stream-id="${detail.id}"
            data-image-url="${escapeHtml(detail.imageUrl ?? "")}"
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
  const resumeMs = saved && isInProgress(saved) ? saved.positionMs ?? 0 : 0;
  const playLabel = resumeMs > 0 ? "Συνέχεια" : "Αναπαραγωγή";
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

  const backdrop = imageUrl ? `<div class="detail-backdrop"><img src="${escapeHtml(imageUrl)}" alt="" /></div>` : "";
  const image = imageUrl
    ? `<img class="detail-cover" src="${escapeHtml(imageUrl)}" alt="" />`
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
            data-resume-ms="${resumeMs}"
            tabindex="0"
          >${playLabel}</button>
        </div>
      </div>
      ${renderResumeDialog(resumeMs)}
    </section>
  `;
}

function renderSeriesDetail(detail: DetailContext): string {
  const info = detail.seriesInfo!;
  const favId = favoriteFromSeries({
    series_id: detail.id,
    name: info.info.name,
    cover: info.info.cover,
  }).id;
  const isFav = favoritesStore.isFavorite(favId);

  const episodes = Object.entries(info.episodes)
    .flatMap(([season, items]) => items.map((ep) => ({ season, ep })));

  const episodeButtons = episodes
    .map(({ season, ep }) => {
      const url = contentService.buildEpisodeUrl(ep.id, ep.container_extension);
      const watchId = seriesEpisodeId(detail.id, ep.id);
      const saved = watchHistoryStore.getEntry(watchId);
      const resumeMs = saved && isInProgress(saved) ? saved.positionMs ?? 0 : 0;
      const label =
        resumeMs > 0
          ? `Συνέχεια S${season} E${ep.episode_num} — ${ep.title}`
          : `S${season} E${ep.episode_num} — ${ep.title}`;
      return `
        <button
          class="episode-btn focusable"
          data-url="${escapeHtml(url)}"
          data-title="${escapeHtml(ep.title)}"
          data-subtitle="${escapeHtml(`S${season} E${ep.episode_num}`)}"
          data-watch-id="${escapeHtml(watchId)}"
          data-watch-type="SERIES_EPISODE"
          data-stream-id="${escapeHtml(ep.id)}"
          data-extension="${escapeHtml(ep.container_extension)}"
          data-series-id="${detail.id}"
          data-season="${season}"
          data-episode-id="${escapeHtml(ep.id)}"
          data-image-url="${escapeHtml(info.info.cover)}"
          data-resume-ms="${resumeMs}"
          tabindex="0"
        >${escapeHtml(label)}</button>
      `;
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
          <div class="episode-list">${episodeButtons}</div>
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
  return [{ id: "off", label: "Ανενεργοί" }, ...parsed.map((t, i) => ({ id: `ext-${i}`, label: t.label, url: t.url }))];
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
    seriesInfo: button.dataset.seriesInfo ? (JSON.parse(button.dataset.seriesInfo) as import("@tv/xtream-core").SeriesInfo) : undefined,
  };
}
