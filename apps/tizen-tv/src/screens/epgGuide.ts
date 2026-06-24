import type { LiveStream } from "@tv/xtream-core";
import type { EpgProgram, XmltvProgram } from "../data/contentService.js";
import { escapeHtml } from "../ui/focus.js";
import { formatEpgTime } from "../data/epgUtils.js";

export interface EpgGuideChannel {
  stream: LiveStream;
  programmes: EpgProgram[];
}

export interface EpgGuideModel {
  channels: EpgGuideChannel[];
  slotStartMs: number;
  slotCount: number;
  slotMinutes: number;
}

const SLOT_MINUTES = 30;
const VISIBLE_SLOTS = 8;
const HOURS_BACK = 1;

export function buildGuideModel(
  channels: LiveStream[],
  programmes: XmltvProgram[] | EpgProgram[],
  nowMs = Date.now(),
): EpgGuideModel {
  const slotStartMs = floorToSlot(nowMs - HOURS_BACK * 60 * 60 * 1000, SLOT_MINUTES);
  const slotEndMs = slotStartMs + VISIBLE_SLOTS * SLOT_MINUTES * 60 * 1000;

  const byChannel = new Map<string, EpgProgram[]>();
  for (const programme of programmes) {
    const channelId = "channelId" in programme ? programme.channelId : "";
    const key = channelId || "";
    if (!key) continue;
    if (programme.end <= slotStartMs || programme.start >= slotEndMs) continue;
    const list = byChannel.get(key) ?? [];
    list.push(programme);
    byChannel.set(key, list);
  }

  const guideChannels: EpgGuideChannel[] = channels.slice(0, 30).map((stream) => {
    const keys = [String(stream.stream_id), stream.epg_channel_id ?? ""].filter(Boolean);
    let items: EpgProgram[] = [];
    for (const key of keys) {
      const found = byChannel.get(key);
      if (found?.length) {
        items = found;
        break;
      }
    }
    return { stream, programmes: items.sort((a, b) => a.start - b.start) };
  });

  return {
    channels: guideChannels,
    slotStartMs,
    slotCount: VISIBLE_SLOTS,
    slotMinutes: SLOT_MINUTES,
  };
}

export function renderEpgGuideScreen(model: EpgGuideModel, loading = false): string {
  const slots = Array.from({ length: model.slotCount }, (_, index) => {
    const start = model.slotStartMs + index * model.slotMinutes * 60 * 1000;
    return `<div class="epg-guide-slot">${escapeHtml(formatEpgTime(start))}</div>`;
  }).join("");

  const rows = model.channels
    .map(({ stream, programmes }) => {
      const cells = programmes
        .map((programme) => {
          const offsetSlots = Math.max(0, (programme.start - model.slotStartMs) / (model.slotMinutes * 60 * 1000));
          const spanSlots = Math.max(1, (programme.end - programme.start) / (model.slotMinutes * 60 * 1000));
          const width = `${Math.min(model.slotCount - offsetSlots, spanSlots) * 100}%`;
          const left = `${offsetSlots * 100}%`;
          return `
            <button
              class="epg-guide-program focusable"
              data-stream-id="${stream.stream_id}"
              data-start="${programme.start}"
              data-end="${programme.end}"
              style="left:${left};width:${width}"
              tabindex="0"
            >
              <span>${escapeHtml(programme.title)}</span>
            </button>
          `;
        })
        .join("");
      return `
        <div class="epg-guide-row">
          <div class="epg-guide-channel focusable" tabindex="0">${escapeHtml(stream.name)}</div>
          <div class="epg-guide-track">${cells}</div>
        </div>
      `;
    })
    .join("");

  return `
    <section class="page epg-guide-page">
      <header class="page-header epg-guide-header">
        <button id="epg-guide-back" class="btn ghost focusable" tabindex="0">← Πίσω</button>
        <h1>Πρόγραμμα TV</h1>
        ${loading ? `<p class="hint">Φόρτωση προγράμματος…</p>` : ""}
      </header>
      <div class="epg-guide-grid">
        <div class="epg-guide-times">${slots}</div>
        <div class="epg-guide-rows">${rows || `<p class="hint">Δεν βρέθηκε πρόγραμμα για αυτή την κατηγορία.</p>`}</div>
      </div>
    </section>
  `;
}

function floorToSlot(ms: number, slotMinutes: number): number {
  const slotMs = slotMinutes * 60 * 1000;
  return Math.floor(ms / slotMs) * slotMs;
}
