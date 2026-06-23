# Akantronics IPTV — Samsung Tizen TV

Web app για **Samsung Neo QLED (Tizen OS)**. Ξεχωριστό project από `apps/android` (κινητό) και `apps/android-tv` (projector).

## Stack

- TypeScript + Vite
- Shared Xtream API: `@tv/xtream-core`
- Supabase session restore (ίδιο cloud με κινητό)
- Playback: Samsung `webapis.avplay` (fallback HTML5 `<video>` στο browser)

## Ρύθμιση

1. Αντέγραψε `local.config.example.js` → `local.config.js` (και στο `dist/` μετά το build).
2. Βάλε τα ίδια Supabase keys με το Android app:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ...",
};
```

3. Εγκατάσταση dependencies (από root monorepo):

```bash
npm install
npm run build:tizen
```

Το build output είναι στο `apps/tizen-tv/dist/` (`index.html`, `config.xml`, assets).

## Deploy στο Samsung TV

### 1. Tizen Studio

- Install: [Samsung Tizen SDK](https://developer.samsung.com/smarttv/develop/getting-started/setup-sdk/prerequisites.html)
- Δημιούργησε Samsung Developer λογαριασμό (δωρεάν για sideload)

### 2. Developer Mode στο TV

1. Τηλεόραση και PC στο **ίδιο δίκτυο**
2. Apps → **123** → Developer Mode **ON**
3. Σημείωσε **IP** και **pairing code**
4. Tizen Studio → Device Manager → Add Device (IP + code)

### 3. Certificate

- Tools → Certificate Manager → **+** → Samsung → **TV seller partner** ή **Author certificate** (dev)
- Βάλε το **DUID** της TV από Device Manager

### 4. Import & install

1. File → Import → Tizen → **Tizen Web project**
2. Root folder: `apps/tizen-tv/dist` (μετά από `npm run build:tizen`)
3. Ή άνοιξε `apps/tizen-tv` και set output path στο dist
4. Build Signed Package (`.wgt`)
5. Run As → Tizen Web Application

### 5. Debug

```bash
sdb shell 0 debug akantolas.AkantronicsIPTV
```

Σύνδεσε Chrome DevTools στο port που εμφανίζεται.

## Χρήση

- **Πρώτη σύνδεση:** κάνε login από κινητό (Android app) — το TV κάνει auto-restore session.
- **Fallback:** χειροκίνητη σύνδεση IPTV (χρειάζεται Bluetooth keyboard στο remote).
- **Remote:** βέλη + OK, Back (10009) για επιστροφή.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev --workspace=@tv/tizen-tv` | Vite dev server (browser preview) |
| `npm run build:tizen` | Build xtream-core + Tizen bundle |
| `npm run typecheck:tizen` | TypeScript check |

## Σημειώσεις

- Τα `apps/android` και `apps/android-tv` **δεν** αλλάζουν — αυτό είναι ξεχωριστό Tizen app.
- Για CSP/network errors, έλεγξε `config.xml` access policy και domain του Xtream server.
- Live streams: AVPlay HLS/TS — test με 1 κανάλι + 1 ταινία νωρίς.
