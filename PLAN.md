# EasyETA_HK - Project Plan

## Project Overview
EasyETA_HK is a Chrome browser extension that provides Hong Kong public transport ETA (Estimated Time of Arrival) information with smart notification features.

## Target Users
1. **Office Workers**: Need automated reminders for their commute home
2. **Students**: Want quick ETA checks and one-time reminders
3. **General Commuters**: Anyone needing convenient bus/transport ETA information

## Core Features

### 1. ETA Checking
- Quick popup interface to check bus ETA
- Support for multiple bus routes and stops
- Save favorite stops for quick access
- Real-time ETA updates

### 2. **Advanced Rule Programming** (Key Feature!)
- **Visual Rule Builder**: Drag-and-drop interface, must be easy to use
- **Condition Engine**: Support complex logic (AND/OR/NOT combinations)
  - Time-based: "Between 4:45 PM and 5:00 PM on weekdays"
  - ETA-based: "When next bus arrives in < 10 minutes"
  - Weather-based: "If raining" (via weather API)
  - Combined: "Alert if no bus in 15 mins AND after 4:45 PM"
- **Action Programming**: Custom notification messages with variables
  - Template syntax: `Next {{route}} bus: {{eta}} mins`
  - Multi-action: Notification + Sound + Badge update
- **Rule Templates**: Pre-built templates for common scenarios
- **Testing/Preview**: Test rules before enabling

### 3. Smart Notifications
- **Recurring Schedules**: Set daily reminders (e.g., 4:45 PM for office workers)
- **One-time Reminders**: Set specific time alerts
- **Conditional Triggers**: Based on programmed rules
- Browser notifications with customizable content
- Snooze and quick actions

### 4. Data Management & Privacy
- **100% Local Storage**: All data stored in browser (Chrome sync storage)
- **Export/Import**: JSON file export for backup and sync
  - Export all settings, rules, and favorites
  - Import to sync across devices/browsers
  - Selective import (rules only, favorites only, etc.)
- **No Cloud Dependency**: Works completely offline (after API data fetch)
- **Privacy-First**: Zero telemetry, no tracking, no external data sharing

## Technical Stack

### Frontend
- **HTML/CSS/JavaScript**: Core extension UI
- **Popup Interface**: For quick ETA checks
- **Options Page**: For settings and rule configuration
- **Notifications API**: Chrome's native notification system

### Chrome Extension APIs
- **Manifest V3**: Latest Chrome extension format
- **Storage API**: Store user preferences and rules
- **Alarms API**: Schedule recurring and one-time notifications
- **Notifications API**: Display alerts
- **Background Service Worker**: Handle scheduled tasks

### External APIs
Hong Kong public transport data sources:
- **DATA.GOV.HK**: Official Hong Kong government open data
- **KMB (九巴) API**: Kowloon Motor Bus
- **CTB/NWFB API**: Citybus/New World First Bus
- **MTR Data**: For MTR bus routes
- Potential APIs:
  - `https://data.etabus.gov.hk/` - Unified bus ETA
  - KMB: `https://data.etagmb.gov.hk/`

## Architecture Design

### File Structure
```
EasyETA_HK/
├── manifest.json              # Extension configuration (Manifest V3)
├── icons/                     # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/                     # Popup interface
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                   # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
├── background/                # Background service worker
│   └── service-worker.js
├── scripts/                   # Shared utilities
│   ├── api.js                # ETA API calls
│   ├── storage.js            # Storage utilities
│   ├── notification.js       # Notification helpers
│   ├── rule-engine.js        # Rule evaluation engine
│   ├── condition-parser.js   # Parse and evaluate conditions
│   ├── expression-builder.js # Visual condition builder
│   └── import-export.js      # Data export/import utilities
├── assets/                    # Images, sounds
│   └── notification.mp3
└── docs/                      # Documentation
    ├── API.md                # API documentation
    ├── USER_GUIDE.md         # User guide
    └── RULE_SYNTAX.md        # Rule programming guide
```

### Data Models

#### Bus Stop
```javascript
{
  id: "unique-id",
  name: "Stop Name",
  stopId: "STOP123",
  location: { lat: 22.xx, lng: 114.xx },
  routes: ["1", "2", "3"]  // Bus routes at this stop
}
```

#### Notification Rule (Enhanced with Programming)
```javascript
{
  id: "rule-id",
  type: "recurring|one-time|conditional",
  enabled: true,
  name: "My Commute Home",
  
  // Schedule (for time-based rules)
  time: "16:45",              // HH:MM format
  days: [1,2,3,4,5],          // Monday-Friday (recurring only)
  date: "2026-01-07",         // Specific date (one-time only)
  
  // Bus stop & route
  stopId: "STOP123",
  route: "1",
  direction: "inbound",
  
  // Programming Mode
  mode: "visual|script",      // Visual builder or script mode
  
  // Visual Mode: Condition Builder
  conditions: {
    operator: "AND",           // AND, OR
    rules: [
      {
        field: "time",
        operator: "between",
        value: ["16:45", "17:00"]
      },
      {
        field: "eta",
        operator: "<",
        value: 15,            // Minutes
        target: "next_bus"   // next_bus, second_bus
      },
      {
        field: "day",
        operator: "in",
        value: [1,2,3,4,5]    // Weekdays
      }
    ]
  },
  
  // Script Mode: Custom JavaScript
  script: `
    // Return true to trigger notification
    function evaluate(context) {
      const { currentTime, eta, route, weather } = context;
      
      // Custom logic
      if (currentTime.hour === 16 && currentTime.minute >= 45) {
        if (eta.next < 15 && eta.next > 5) {
          return true;
        }
      }
      return false;
    }
  `,
  
  // Action Settings (supports templates)
  actions: [
    {
      type: "notification",
      title: "Bus Alert: {{route}}",
      message: "Next bus in {{eta.next}} mins ({{eta.time}})",
      icon: "bus",
      sound: true,
      priority: "high"
    },
    {
      type: "badge",
      text: "{{eta.next}}"
    }
  ],
  
  // Legacy fields (for simple rules)
  advanceMinutes: 5,
  message: "Time to catch your bus!",
  sound: true,
  
  // Metadata
  createdAt: "ISO-8601",
  updatedAt: "ISO-8601",
  lastTriggered: "ISO-8601",
  triggerCount: 0
}
```

#### Favorite Stop
```javascript
{
  stopId: "STOP123",
  stopName: "Stop Name",
  route: "1",
  nickname: "Home Stop",      // User-defined name
  addedAt: "ISO-8601"
}
```

#### Export/Import Format
```javascript
{
  version: "1.0.0",           // Schema version
  exportedAt: "ISO-8601",
  exportedBy: "EasyETA_HK v1.0",
  
  data: {
    rules: [/* Array of rule objects */],
    favorites: [/* Array of favorite stops */],
    settings: {
      theme: "light",
      language: "en",
      defaultNotificationSound: true,
      // ... other preferences
    }
  },
  
  // Metadata
  stats: {
    totalRules: 5,
    totalFavorites: 8,
    rulesEnabled: 3
  }
}
```

## Development Phases

### Phase 1: Foundation (Week 1)
- [x] Create project plan
- [ ] Set up basic extension structure
- [ ] Create manifest.json (Manifest V3)
- [ ] Design basic popup UI (HTML/CSS)
- [ ] Implement storage utilities

### Phase 2: ETA Integration (Week 2)
- [ ] Research and test HK bus ETA APIs
- [ ] Implement API client for fetching ETA
- [ ] Create bus stop search functionality
- [ ] Display ETA in popup interface
- [ ] Add refresh functionality

### Phase 3: Favorites Management (Week 3)
- [ ] Implement add/remove favorites
- [ ] Display favorite stops in popup
- [ ] Quick ETA check for favorites
- [ ] Edit favorite nicknames

### Phase 4: Rule Engine & Programming (Week 4)
- [ ] Design rule data structure
- [ ] Build condition parser/evaluator
- [ ] Implement visual condition builder UI
- [ ] Create script mode editor (with syntax highlighting)
- [ ] Build expression context (time, ETA, weather, etc.)
- [ ] Add rule templates library
- [ ] Implement rule testing/preview

### Phase 5: Notification System (Week 5)
- [ ] Create options page UI for rules
- [ ] Set up background service worker
- [ ] Implement Chrome Alarms API
- [ ] Build notification trigger logic
- [ ] Fetch ETA when rules evaluate
- [ ] Display browser notifications with templates
- [ ] Handle notification clicks (open popup)
- [ ] Add notification history

### Phase 6: Export/Import & Data Management (Week 6)
- [ ] Implement export functionality (JSON download)
- [ ] Implement import with validation
- [ ] Add selective import options
- [ ] Create data migration for schema updates
- [ ] Add backup reminder system
- [ ] Build data viewer/inspector

### Phase 7: Polish & Testing (Week 7)
- [ ] UI/UX improvements
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] Write user documentation (including rule programming guide)
- [ ] Browser testing
- [ ] Security audit (script sandboxing)
- [ ] Prepare for Chrome Web Store

## Key Features Detail

### Use Case 1: Office Worker (9-5) - Advanced Programming
**Scenario**: Need to catch the 5:00 PM bus home, but only alert if bus is coming soon
**Solution**:

**Option A - Visual Builder**:
1. User adds their bus stop near office to favorites
2. Creates a conditional rule using visual builder:
   - **Condition 1**: Time between 4:45 PM and 5:00 PM
   - **Condition 2**: Day is Monday-Friday
   - **Condition 3**: Next bus ETA < 15 minutes AND > 3 minutes
   - **Logic**: ALL conditions must be true (AND)
   - **Action**: Notification with template:
     - Title: "Time to leave!"
     - Message: "Next {{route}} bus in {{eta.next}} mins ({{eta.time}})"

**Option B - Script Mode** (for power users):
```javascript
function evaluate(context) {
  const { currentTime, eta, weather } = context;
  
  // Only on weekdays between 4:45-5:00 PM
  const isWeekday = currentTime.day >= 1 && currentTime.day <= 5;
  const isTimeRange = currentTime.hour === 16 && currentTime.minute >= 45;
  
  // Alert only if bus is 5-15 mins away
  const isGoodTiming = eta.next >= 5 && eta.next <= 15;
  
  // Don't alert if raining and no nearby bus (need umbrella time)
  if (weather.raining && eta.next > 10) {
    return false;
  }
  
  return isWeekday && isTimeRange && isGoodTiming;
}
```

**Result**: Smart notifications only when needed, avoiding spam

### Use Case 2: Student
**Scenario 1 - One-time reminder**:
1. Opens extension popup
2. Searches for bus stop
3. Sets one-time reminder with simple condition:
   - Time: "Tomorrow 8:30 AM"
   - Alert if next bus < 20 minutes
4. Gets notification when time arrives

**Scenario 2 - Quick check**:
1. Clicks extension icon
2. Sees saved favorite stops with live ETA
3. Clicks refresh if needed

**Scenario 3 - Sync between devices**:
1. Student has EasyETA_HK on laptop and desktop
2. Sets up rules on laptop
3. Goes to Settings → Export Data → Downloads `easyeta_backup.json`
4. On desktop: Settings → Import Data → Uploads file
5. All rules, favorites, and settings instantly synced!
6. Can also use Chrome Sync (if enabled) for automatic sync

## API Integration Strategy

### HK Bus ETA APIs
We'll use the government's open data portal:

1. **Route Search**: Find all routes serving a stop
2. **ETA Fetch**: Get real-time ETA for specific route+stop
3. **Stop Information**: Get stop names and locations

### API Call Flow
```
User Action → Extension → HK Gov API → Parse Response → Display
                ↓                          ↓
            Cache          ←─────    Update Cache
```

### Rate Limiting
- Cache ETA data for 30 seconds
- Batch API calls when possible
- Show "last updated" timestamp

## Privacy & Permissions

### Required Permissions
- `storage`: Save user preferences and rules locally
- `alarms`: Schedule notifications
- `notifications`: Display alerts
- `host_permissions`: Access HK transport APIs
- `downloads`: Export data to JSON file (optional)

### Data Privacy - Core Principle
**100% Local, 100% Private, 100% User-Controlled**

- **Local Storage Only**: All data stored in browser's local storage
  - Rules, favorites, settings, history
  - No cloud storage, no external servers
  - Works completely offline (after initial API setup)

- **Chrome Sync** (Optional):
  - Users can enable Chrome's built-in sync
  - Data encrypted by Google, synced across Chrome instances
  - Fully controlled by user's Chrome settings

- **Export/Import for Manual Sync**:
  - Export all data to JSON file (human-readable)
  - Import on any browser/device
  - Complete data portability
  - Users own their data

- **Zero Telemetry**:
  - No analytics, no tracking, no usage data collection
  - No user behavior monitoring
  - No crash reports sent externally

- **API Calls**:
  - Only to official HK government transport APIs
  - No personal data sent in requests
  - API calls contain only: route numbers, stop IDs
  - No cookies, no authentication required

## Success Metrics
1. ETA accuracy (compared to official apps)
2. Notification reliability (fires on time)
3. User satisfaction (Chrome Web Store ratings)
4. Performance (load time < 1 second)

## Future Enhancements (V2.0+)

### Programming & Automation
- **Rule Marketplace**: Share and import community rules
- **Advanced Scripting**: Support for async operations in scripts
- **Webhook Actions**: Trigger external services (IFTTT, Zapier)
- **Multi-rule Chains**: Rules that trigger other rules
- **Machine Learning**: Learn user patterns, suggest rules
- **API for Developers**: Allow third-party integrations

### Features
- Support for MTR, tram, ferry ETA
- Route planning with multi-modal transport
- Multiple language support (EN/繁體/简体)
- Dark mode
- Location-based suggestions
- Geolocation for nearby stops
- Historical ETA data analysis
- Crowdsourced bus capacity data

### Data Management
- Automatic cloud backup (with user consent)
- Version control for rules (rollback changes)
- Rule conflict detection
- Performance analytics for rules

## Risk Mitigation

### Technical Risks
- **API Changes**: Monitor API deprecation notices, build abstraction layer
- **API Downtime**: Implement fallback, show cached data, clear error messages
- **Chrome API Changes**: Stay updated with Manifest V3 changes

### User Experience Risks
- **Notification Fatigue**: Allow easy disable, smart frequency limits
- **Complex UI**: Keep it simple, progressive disclosure
- **First-time Setup**: Add onboarding wizard

## Timeline
- **Week 1-2**: Foundation + ETA Integration
- **Week 3**: Favorites Management
- **Week 4**: Rule Engine & Programming Features
- **Week 5**: Notification System
- **Week 6**: Export/Import & Data Management
- **Week 7**: Polish, Testing, Documentation

**Target Launch**: 7 weeks from start

## Key Differentiators

### Why EasyETA_HK Stands Out:
1. **Programming-First Design**: Not just a notification tool, but a programmable automation platform
2. **Privacy-Focused**: 100% local storage, complete data ownership
3. **Export/Import**: True data portability, no vendor lock-in
4. **Dual Interface**: Visual builder for beginners, script mode for power users
5. **Open Architecture**: Designed for extensibility and community contributions

## Next Steps
1. ✅ Create this plan document
2. ✅ Emphasize programming & privacy features
3. Set up basic extension structure
4. Research HK bus ETA APIs and test endpoints
5. Design rule engine architecture
6. Create wireframes for UI (especially rule builder)
7. Begin Phase 1 development

---

**Document Version**: 2.0  
**Last Updated**: 2026-01-07  
**Status**: Planning Complete with Programming Emphasis, Ready for Development
