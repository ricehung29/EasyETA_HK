# Getting Started with EasyETA_HK

## Quick Setup Guide

### 1. Installation

Since the extension is still in development, follow these steps to install it locally:

1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top right corner)
4. Click "Load unpacked"
5. Select the `EasyETA_HK` folder

**Note**: You'll need to generate the icon PNG files first. See `icons/README.md` for instructions.

### 2. First-Time Setup

After installation:

1. **Click the extension icon** in the Chrome toolbar to open the popup
2. **Search for your bus stop** using the search box
3. **Add favorite stops** by clicking on search results
4. **Open Settings** (⚙️ button) to create notification rules

### 3. Creating Your First Rule

Let's create a simple "Office Commute" rule:

#### Option A: Simple Recurring Notification

1. Go to Options page (Settings button in popup or right-click extension icon → Options)
2. Click "Add New Rule"
3. Fill in:
   - **Name**: "Time to leave office"
   - **Type**: Recurring (Daily)
   - **Time**: 16:45 (4:45 PM)
   - **Days**: Monday-Friday (check all weekdays)
   - **Bus Stop ID**: Your office bus stop
   - **Message**: "Next {{route}} bus in {{eta.next}} mins"
4. Click "Save Rule"

#### Option B: Advanced Conditional Rule (Script Mode)

1. Go to Options page → Add New Rule
2. Fill in:
   - **Name**: "Smart commute alert"
   - **Type**: Conditional (Advanced)
   - **Mode**: Script Mode
   - **Bus Stop ID**: Your stop
   - **Script**:
   ```javascript
   function evaluate(context) {
     const { currentTime, eta } = context;
     
     // Only trigger on weekdays between 4:45-5:00 PM
     const isWeekday = currentTime.day >= 1 && currentTime.day <= 5;
     const isTimeWindow = currentTime.hour === 16 && currentTime.minute >= 45;
     
     // Only alert if bus arrives in 5-15 minutes
     const isGoodTiming = eta.next >= 5 && eta.next <= 15;
     
     return isWeekday && isTimeWindow && isGoodTiming;
   }
   ```
3. Click "Test Rule" to verify it works
4. Click "Save Rule"

### 4. Using the Popup

- **Quick ETA Check**: Click extension icon to see your favorite stops
- **Refresh**: Click the refresh button to update all ETAs
- **Search**: Use the search box to find new stops
- **Tabs**: Switch between Favorites and Recent searches

### 5. Exporting Your Data

To sync your settings to another device:

1. Go to Options → Data Management
2. Click "Export All"
3. Save the JSON file
4. On another device: Import the file to restore all settings

## Tips & Tricks

### Understanding the Script Context

When writing custom scripts, you have access to:

```javascript
context = {
  currentTime: {
    hour: 16,        // 24-hour format
    minute: 45,
    day: 1,          // 0=Sunday, 1=Monday, ..., 6=Saturday
    date: 7,
    month: 0,        // 0=January, 11=December
    year: 2026
  },
  eta: {
    next: 8,         // Minutes until next bus
    second: 15,      // Minutes until second bus
    third: 22,       // Minutes until third bus
    time: "5:03 PM", // Absolute time of next bus
    all: [...]       // Array of all ETAs
  }
}
```

### Template Variables in Messages

Use these variables in notification messages:

- `{{route}}` - Bus route number
- `{{eta.next}}` - Minutes until next bus
- `{{eta.time}}` - Absolute time of next bus
- `{{eta.second}}` - Minutes until second bus

Example: `"Route {{route}} arriving in {{eta.next}} mins ({{eta.time}})"`

### Common Rule Patterns

**Weekend Alert**:
```javascript
function evaluate(context) {
  return context.currentTime.day === 0 || context.currentTime.day === 6;
}
```

**Rush Hour Only**:
```javascript
function evaluate(context) {
  const hour = context.currentTime.hour;
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
}
```

**No Bus Soon Warning**:
```javascript
function evaluate(context) {
  // Alert if next bus is more than 20 minutes away
  return context.eta.next > 20;
}
```

## Troubleshooting

### Extension doesn't load
- Make sure all icon files are present (see `icons/README.md`)
- Check browser console for errors (F12 → Console)

### Rules not triggering
- Check that the rule is enabled (green badge in Options)
- Verify the bus stop ID is correct
- Test the rule using "Test Rule" button
- Check notification permissions in Chrome settings

### ETA not showing
- Click refresh button
- Check internet connection
- API integration is currently using mock data (will be replaced with real HK government APIs)

## What's Next?

- **Phase 2**: Real HK bus ETA API integration
- **Phase 3**: Advanced condition builder (visual mode)
- **Phase 4**: Weather integration
- **Phase 5**: MTR, tram, ferry support

## Need Help?

- Check the [PLAN.md](../PLAN.md) for detailed architecture
- Open an issue on GitHub
- Review the code comments in each file

---

Happy commuting! 🚌
