# EasyETA_HK 🚌

A Chrome extension for Hong Kong public transport ETA (Estimated Time of Arrival) with smart favourites, folder organisation, and real-time bus tracking.

## Features

- **Real-time ETA** — Live arrival times for KMB, CTB, and GMB buses
- **Route & Stop Search** — Search by route number or stop name with autocomplete
- **Smart Favourites** — Save frequently used stops, organised into folders
- **Timeslot-aware Folders** — Folders activate automatically based on time of day (e.g., "Work" folder shows only during commute hours)
- **Folder Priority** — When timeslots overlap, priority determines which folder appears first
- **Dark Mode** — Full dark theme support
- **Bilingual** — English and 繁體中文 (Traditional Chinese)
- **Export/Import** — Backup and restore your data as JSON
- **Privacy-first** — All data stored locally, zero telemetry

## Installation

### From Source (Developer)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/EasyETA_HK.git
   ```
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `EasyETA_HK` folder

### Usage

1. **Right-click the extension icon** → "Open side panel" (or click the icon for popup)
2. **Search** for a route number (e.g., `968`, `1A`, `NA30`) or stop name
3. **Click a route** to see all stops with real-time ETA
4. **Star a stop** to add it to favourites
5. **Create folders** in Settings to organise favourites by time of day

## Supported Operators

| Operator | Route Search | Stop Search | Real-time ETA |
|----------|:-----------:|:-----------:|:-------------:|
| KMB (九巴) | ✅ | ✅ | ✅ (bulk) |
| CTB (城巴) | ✅ | ✅ | ✅ (per-stop) |
| GMB (綠色小巴) | ✅ | — | — |

> **Note**: Some route numbers exist in both KMB and CTB as completely different routes (e.g., KMB route 1 = Chuk Yuen Estate ↔ Star Ferry, CTB route 1 = Central ↔ Happy Valley). The extension shows both with a provider badge so you can pick the right one.

## Project Structure

```
EasyETA_HK/
├── manifest.json              # Chrome Manifest V3 config
├── popup/                     # Main popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/
│   └── service-worker.js      # Alarms, notifications, rule evaluation
├── scripts/
│   ├── api.js                 # HK transport API client (KMB, CTB, GMB)
│   ├── storage.js             # Chrome storage utilities
│   ├── rule-engine.js         # Rule evaluation engine
│   ├── import-export.js       # Data backup/restore
│   └── i18n.js                # English + 繁體中文
├── icons/                     # Extension icons + SVG sprite
└── _locales/                  # Chrome i18n manifests
```

## Tech Stack

- **Vanilla JavaScript** — No frameworks, no build step
- **Chrome Manifest V3** — Latest extension standard
- **Chrome APIs** — Storage, Alarms, Notifications
- **HK Open Data** — Official government transport APIs:
  - `data.etabus.gov.hk` (KMB)
  - `rt.data.gov.hk` (CTB)
  - `data.etagmb.gov.hk` (GMB)

## Privacy

- **100% local storage** — All data stays in your browser
- **Zero telemetry** — No tracking, no analytics
- **No cloud dependency** — Works offline after initial route cache
- **API calls** — Only to official HK government transport APIs, no personal data sent

## Development

```bash
# No build step needed — load directly in Chrome
# 1. Make changes to the source files
# 2. Go to chrome://extensions/
# 3. Click the refresh icon on the EasyETA_HK card
```

## Roadmap

- [x] Route search (KMB, CTB, GMB)
- [x] Real-time ETA display
- [x] Favourites with folder organisation
- [x] Timeslot-aware folder filtering
- [x] Dark mode
- [x] Bilingual UI (EN/繁體中文)
- [x] Export/Import data
- [x] Notification rules (script mode)
- [ ] Visual rule builder
- [ ] Weather API integration
- [ ] MTR, tram, ferry support
- [ ] Chrome Web Store release

## License

MIT
