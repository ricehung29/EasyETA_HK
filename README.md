# EasyETA_HK 🚌

A powerful Chrome extension for Hong Kong public transport with advanced rule programming, smart notifications, and a modern Tailwind UI.

## ✨ Features

### 📱 **Smart Side Panel Interface**
- **Direct Route Display**: Search shows complete route with all stops and real-time ETA
- **Live ETA Integration**: Automatic loading of arrival times for first 10 stops
- **Interactive Stop List**: Click any stop to load individual ETA information
- **Route Refresh**: One-click refresh for all ETA data on a route
- **Settings Access**: Direct link to options page for configuration

### ⭐ Smart Favorites & History
- **Quick Access**: Save frequently used stops
- **Recent Searches**: Auto-track your route searches
- **One-Tap ETA**: Instant real-time arrival information
- **Persistent Storage**: All data saved locally in Chrome
- **Organized Tabs**: Separate views for favorites and route search

### 🔧 Advanced Rule Programming
**EasyETA_HK is not just a notification tool—it's a programmable automation platform!**

- **Visual Rule Builder**: Drag-and-drop interface for easy setup
- **Script Mode**: Write custom JavaScript for power users
- **Complex Conditions**: Combine time, ETA, weather, and more
- **Template Syntax**: Dynamic notifications with variables
- **Rule Templates**: Pre-built scenarios to get started quickly

**Example Rule (Script Mode)**:
```javascript
function evaluate(context) {
  const { currentTime, eta, weather } = context;
  
  // Alert only on weekdays between 4:45-5:00 PM
  const isWeekday = currentTime.day >= 1 && currentTime.day <= 5;
  const isTimeRange = currentTime.hour === 16 && currentTime.minute >= 45;
  const isGoodTiming = eta.next >= 5 && eta.next <= 15;
  
  // Skip if raining and bus is far (need umbrella time!)
  if (weather.raining && eta.next > 10) return false;
  
  return isWeekday && isTimeRange && isGoodTiming;
}
```

### 🔒 Privacy-First Design
- **100% Local Storage**: All data stored in your browser
- **Zero Telemetry**: No tracking, no analytics, no data collection
- **No Cloud Dependency**: Works completely offline (after route cache)
- **API Resilience**: Graceful fallback to mock data when APIs are unavailable
- **Export/Import**: Full data portability and backup

### 💾 Data Management
- Export all settings, rules, and favorites to JSON
- Import to sync across devices/browsers
- Selective import (rules only, favorites only, etc.)
- Optional Chrome Sync for automatic syncing
- Complete data ownership

## 🎓 Use Cases

### Office Worker (9-5)
Set up smart notifications for your commute home:
- Trigger at 4:45 PM on weekdays
- Only alert if bus arrives in 5-15 minutes
- Skip notifications if no good bus timing
- Customize messages with route and ETA info

### Student
- Quick ETA checks with saved favorite stops
- Route autocomplete for easy discovery
- One-time reminders for specific times
- Recent searches for frequently used routes

## 🚀 Installation

### From Chrome Web Store
_(Coming soon)_

### Developer Installation
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `EasyETA_HK` folder

## 📖 Quick Start

### Search for a Route
1. **Right-click the extension icon** → "Open side panel"
2. Type a route number (e.g., "1", "2X", "234A")
3. Select from autocomplete suggestions
4. **Choose direction** (Outbound/Inbound) if multiple options available
5. View stops and real-time ETAs

### Check ETA
1. Click on any stop in the route list
2. View real-time ETA in a beautiful modal
3. ETA auto-refreshes every 30 seconds
4. Add to favorites for quick access

### Manage Favorites
1. After viewing ETA, click "★ Add to Favorites"
2. Access favorites from the main tab
3. One-tap to view ETA anytime
4. Remove with the trash icon

### Customize Settings
1. Click the settings icon (⚙️) in the header
2. Choose ETA display format (relative, absolute, or both)
3. Settings are saved automatically

### Getting Started
1. **Right-click the extension icon** → "Open side panel"
2. **Search for your bus stop** and add to favorites
3. **Set up rules** in the Options page:
   - Simple: Use the visual builder
   - Advanced: Switch to script mode
4. **Get notifications** automatically based on your rules!

## 🛠️ For Developers

### Tech Stack
- **Manifest V3**: Latest Chrome extension standard
- **Vanilla JavaScript**: No framework dependencies
- **Chrome APIs**: Storage, Alarms, Notifications
- **HK Open Data**: Official government transport APIs

### Project Structure
```
EasyETA_HK/
├── manifest.json              # Extension configuration
├── sidepanel/                 # Side panel interface
├── options/                   # Settings page
├── background/                # Service worker
├── scripts/                   # Shared utilities
│   ├── api.js                # ETA API client
│   ├── storage.js            # Storage utilities
│   ├── rule-engine.js        # Rule evaluation
│   └── import-export.js      # Data management
└── docs/                      # Documentation
```

### Contributing
Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

See [PLAN.md](PLAN.md) for detailed development roadmap.

## 📋 Roadmap

- [x] Project planning and architecture
- [ ] Core ETA functionality
- [ ] Rule programming engine
- [ ] Notification system
- [ ] Export/import features
- [ ] Chrome Web Store release
- [ ] Multi-language support (EN/繁體/简体)
- [ ] MTR, tram, ferry support

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Hong Kong Government Open Data Portal
- Hong Kong public transport operators (KMB, CTB, NWFB)
- Chrome Extension community

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the [User Guide](docs/USER_GUIDE.md) (coming soon)
- Review the [Rule Syntax Guide](docs/RULE_SYNTAX.md) (coming soon)

---

**Made with ❤️ for Hong Kong commuters**