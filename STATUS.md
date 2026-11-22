# EasyETA_HK Development Status

## Current Version: v1.2.0

## What's Working

### Core Features
- **Route Search & Display**: Search KMB, CTB, and GMB routes with real-time autocomplete
- **Stop Search**: Search by bus stop name (KMB stops, ~6,700 stops)
- **ETA Display**: Real-time ETA data for all stops on a route with auto-refresh (30s intervals)
- **Favorites System**: Add/remove favorites with folder organization
- **Folder Management**: Create folders with timeslots and priority ordering
- **Dark Mode**: Full dark mode support across all pages
- **Internationalization**: English and Traditional Chinese (zh-HK) support

### Popup Interface (380×600px)
- Home view with ETA chips per favourite and recent searches
- Folder tab pills sorted by priority — off-hours folders stay reachable, active ones carry a live dot
- Search view with a route/stop segmented control and provider-badged result cards (KMB/CTB/GMB)
- Route details view: timeline stop list with inline ETA chips from a single bulk call, 30 s auto-refresh, tap a stop for absolute times and remarks
- Settings view with dark mode, language, and auto-refresh toggles
- hkbus.app-inspired dark-first visual language (444 px column, KMB/CTB/GMB accent chips)

### Options Page
- Folders & Favorites management with visual timeslot editor
- App settings (dark mode, auto-refresh, language) — dark mode redefines the design tokens, so text and surfaces stay legible
- Test notification button (wired to the service worker)
- Reset All Data row wired to the same confirmation flow as Clear Everything
- Data management (export/import JSON, clear all data)
- Storage usage display
- Folder priority management with drag-and-drop reordering

### Background Service Worker
- Alarm-based rule checking (every minute)
- ETA fetching for rules
- Notification display with template variable support
- Notification click handling (opens popup)

### API Integration
- **KMB API**: Route search, stop details, bulk route ETA (one call per route)
- **CTB API**: Route search, stop details, per-stop ETA (batched, 6 at a time)
- **GMB API**: Route index + per-region route detail, route-stop list, per-stop ETA (batched)
- Every direction of a route code from every operator that runs it, each tagged with a provider badge
- KMB's 6,744-stop master list replaces per-stop name lookups; CTB stop names resolved once and persisted; GMB names come with the route-stop payload
- Stale ETAs (bus already departed) dropped after 60 s
- Rate limiting (10 requests/second), 30-second response window cache, 7-day storage cache for reference data

### Rule Engine
- Recurring rules (daily/weekly schedule)
- One-time rules (specific date/time)
- Route/stop ETA rules for KMB, CTB, and GMB
- Weekday and time-window schedules, pause/resume, and delete controls
- Threshold-crossing notifications (re-arms after the ETA moves above threshold)
- Template variable system for notification messages
- Custom JavaScript rules are intentionally disabled for extension security

### Data Management
- JSON export/import with validation
- Selective import (rules, favorites, settings)
- Merge vs replace options
- Version compatibility checking

## Known Limitations

- Rule alerts are evaluated once per minute (Chrome alarms granularity); sound is controlled by OS notification settings
- Custom JavaScript rules are disabled because user-authored scripts would run with extension privileges
- No weather API integration
- No geolocation/nearby stops feature
- No MTR, tram, or ferry support
- KMB API does not expose timetable/schedule data (only real-time ETA)
- Stop-name search covers KMB stops only (the stop index is KMB's); CTB/GMB stops are reachable from a route
- GMB terminal names from `/route/{region}/{code}` can differ cosmetically from the names in `/route-stop/{route_id}/{seq}` — the header uses the former, the rows the latter

## File Structure

```
EasyETA_HK/
├── manifest.json              # Chrome Manifest V3
├── popup/                     # Popup interface (380×600px)
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Options/settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/                # Background service worker
│   └── service-worker.js
├── scripts/                   # Shared utilities
│   ├── api.js                 # HK transport API client
│   ├── storage.js             # Chrome storage utilities
│   ├── rule-engine.js         # Rule evaluation engine
│   ├── import-export.js       # Data export/import
│   ├── i18n.js                # Internationalization
│   └── api.selftest.js        # node scripts/api.selftest.js
├── icons/                     # Extension icons
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── sprite.svg
├── _locales/                  # Chrome i18n
│   ├── en/messages.json
│   └── zh_HK/messages.json
└── PLAN.md                    # Development roadmap
```

## Testing

1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the EasyETA_HK folder
4. Click the extension icon to open the popup
5. Test route search, favorites, and settings
6. `node scripts/api.selftest.js` — route/variant logic self-check

---

**Last Updated**: 2026-11-22
