import type { AppState } from "../app/store.js";
import { brandLockup } from "../ui/brand.js";
import { escapeHtml } from "../ui/focus.js";

export function renderLoginScreen(state: AppState): string {
  const error = state.error
    ? `<div class="banner banner-error">${escapeHtml(state.error)}</div>`
    : "";

  return `
    <div class="login-screen cinema-bg">
      <div class="login-brand-block">
        ${brandLockup({ tagline: true })}
        <p class="brand-description">Οι ταινίες, οι σειρές και τα κανάλια σου — παντού.</p>
      </div>
      ${error}
      <div class="login-panels">
        <section class="login-panel login-panel-account">
          <div class="step-indicator"><span class="active">1</span><span>2</span></div>
          <h2>Σύνδεση λογαριασμού</h2>
          <p class="hint">Σύνδεση μία φορά από κινητό — εδώ γίνεται αυτόματη επαναφορά session.</p>
          <ul class="feature-list">
            <li>Cloud sync playlists</li>
            <li>Συνέχεια αναπαραγωγής</li>
            <li>Αγαπημένα & ιστορικό</li>
          </ul>
          <form id="login-form" class="stack-form">
            <label>
              Email
              <input id="account-email" class="focusable" type="email" autocomplete="username" />
            </label>
            <label>
              Κωδικός
              <input id="account-password" class="focusable" type="password" autocomplete="current-password" />
            </label>
            <button type="submit" class="btn primary focusable">Σύνδεση</button>
            <button type="button" id="toggle-register" class="btn ghost focusable" data-register="false">
              Δημιουργία λογαριασμού
            </button>
            <button type="button" id="use-xtream" class="btn ghost focusable">
              Χειροκίνητη σύνδεση IPTV
            </button>
          </form>
        </section>
        <section class="login-panel login-panel-xtream hidden">
          <div class="step-indicator"><span>1</span><span class="active">2</span></div>
          <h2>Σύνδεση IPTV</h2>
          <p class="hint">Bluetooth keyboard ή σύνδεση από κινητό πρώτα.</p>
          <form id="xtream-form" class="stack-form">
            <label>
              Server URL
              <input id="xtream-server" class="focusable" type="text" placeholder="http://example.com:8080" />
            </label>
            <label>
              Username
              <input id="xtream-user" class="focusable" type="text" />
            </label>
            <label>
              Password
              <input id="xtream-pass" class="focusable" type="password" />
            </label>
            <button type="submit" class="btn primary focusable">Σύνδεση IPTV</button>
          </form>
        </section>
      </div>
    </div>
  `;
}
