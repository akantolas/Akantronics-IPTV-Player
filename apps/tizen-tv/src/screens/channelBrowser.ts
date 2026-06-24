import type { LiveStream } from "@tv/xtream-core";
import { escapeHtml } from "../ui/focus.js";

export function renderChannelBrowserOverlay(
  channels: LiveStream[],
  activeIndex: number,
  numericBuffer: string,
): string {
  if (channels.length === 0) return "";

  const rows = channels
    .map((channel, index) => {
      const active = index === activeIndex ? " is-active" : "";
      const icon = channel.stream_icon
        ? `<img class="channel-browser-icon" src="${escapeHtml(channel.stream_icon)}" alt="" />`
        : `<span class="channel-browser-icon placeholder">${escapeHtml(channel.name.slice(0, 1))}</span>`;
      return `
        <button
          class="channel-browser-row focusable${active}"
          data-channel-index="${index}"
          tabindex="0"
        >
          <span class="channel-browser-num">${index + 1}</span>
          ${icon}
          <span class="channel-browser-name">${escapeHtml(channel.name)}</span>
        </button>
      `;
    })
    .join("");

  const numericHint = numericBuffer
    ? `<p class="channel-browser-numeric">Κανάλι: ${escapeHtml(numericBuffer)}</p>`
    : `<p class="hint channel-browser-numeric">0–9 για άμεση επιλογή</p>`;

  return `
    <aside id="channel-browser" class="channel-browser" aria-label="Λίστα καναλιών">
      <header class="channel-browser-header">
        <h2>Κανάλια</h2>
        ${numericHint}
      </header>
      <div class="channel-browser-list">${rows}</div>
    </aside>
  `;
}

export function renderZapBanner(
  channelName: string,
  channelIndex: number,
  totalChannels: number,
  channelIcon?: string,
  epgNowTitle?: string,
): string {
  const logo = channelIcon
    ? `<img class="zap-banner__logo" src="${escapeHtml(channelIcon)}" alt="" />`
    : `<span class="zap-banner__logo zap-banner__logo--placeholder">${escapeHtml(channelName.slice(0, 1))}</span>`;
  const epgLine = epgNowTitle
    ? `<span class="zap-banner__epg">Τώρα · ${escapeHtml(epgNowTitle)}</span>`
    : "";
  return `
    <div id="zap-banner" class="zap-banner">
      ${logo}
      <div class="zap-banner__body">
        <strong>${escapeHtml(channelName)}</strong>
        <span class="zap-banner__index">${channelIndex} / ${totalChannels}</span>
        ${epgLine}
      </div>
    </div>
  `;
}
