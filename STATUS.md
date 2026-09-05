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
- Home view with favorites and recent searches
- Search view with route and stop search modes
- Route details view with timeline-style stop list
- Settings view with dark mode, language, and auto-refresh toggles
- Folder-based favorite tabs with timeslot-aware filtering

### Options Page
- Folders & Favorites management with visual timeslot editor
- App settings (dark mode, auto-refresh, language)
- Test notification feature
- Data management (export/import JSON, clear all data)
- Storage usage display
- Folder priority management with drag-and-drop reordering

### Background Service Worker
- Alarm-based rule checking (every minute)
- ETA fetching for rules
- Notification display with template variable support
- Notification click handling (opens popup)

### API Integration
- **KMB API**: Route search, stop details, bulk route ETA
- **CTB API**: Route search, stop details, per-stop ETA
- **GMB API**: Route list (green minibus)
- Smart provider detection (KMB vs CTB for ambiguous routes)
- Rate limiting (10 requests/second)
- 30-second response caching

### Rule Engine
- Recurring rules (daily/weekly schedule)
- One-time rules (specific date/time)
- Conditional rules with visual builder and script mode
- Template variable system for notification messages

### Data Management
- JSON export/import with validation
- Selective import (rules, favorites, settings)
- Merge vs replace options
- Version compatibility checking

## Known Limitations

- Visual rule builder UI not fully implemented (script mode works)
- No weather API integration
- No geolocation/nearby stops feature
- No MTR, tram, or ferry support
- KMB API does not expose timetable/schedule data (only real-time ETA)

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
│   └── i18n.js               # Internationalization
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

---

**Last Updated**: 2026-09-06
