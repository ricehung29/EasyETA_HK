# Testing Guide - Phase 2 KMB Integration

## 🚀 Quick Test Steps

### 1. Load Extension in Chrome

```bash
# Open Chrome and navigate to:
chrome://extensions/

# Steps:
1. Toggle "Developer mode" (top-right corner)
2. Click "Load unpacked"
3. Navigate to: /Users/rice/Documents/GitHub/EasyETA_HK
4. Click "Select" or "Open"
```

### 2. Verify Extension Loaded

✅ Check for:
- EasyETA_HK appears in extension list
- Extension icon visible in Chrome toolbar
- No errors in extension card

### 3. Test Basic Functionality

#### A. Open Popup
1. Click extension icon in toolbar
2. Verify:
   - 420x600px popup window appears
   - Gradient header visible (blue to purple)
   - "LIVE" badge animating (pulse)
   - Route input field present
   - Favorites/Routes tabs visible

#### B. Test Route Search
1. Click in route input field
2. Type: **"1"**
3. Verify:
   - Autocomplete dropdown appears
   - Multiple Route 1 variants shown
   - Chinese and English names displayed
   - "→" arrow between origin/destination

4. Type: **"2"**
5. Verify autocomplete updates

6. Type: **"6"**
7. Verify autocomplete shows Route 6 variants

#### C. Select a Route
1. Type "1" and wait for suggestions
2. Click on first suggestion
3. Verify:
   - Loading overlay appears (backdrop blur)
   - Route variants displayed (Inbound/Outbound)
   - First 5 stops shown per variant
   - Stop numbers (1, 2, 3, 4, 5) in blue circles
   - "View ETA →" button on each stop

#### D. View ETA
1. Click "View ETA →" on any stop
2. Verify:
   - Loading overlay shows
   - ETA modal appears with:
     - Route badge at top
     - Stop name in header
     - List of next buses
     - Formatted time (e.g., "3 mins", "Arriving")
     - Color-coded cards (red/yellow/green)
     - "★ Add to Favorites" button
     - "Auto-refresh in 30s" text

3. Wait 30 seconds
4. Verify ETA updates automatically

#### E. Add to Favorites
1. In ETA modal, click "★ Add to Favorites"
2. Verify:
   - Green success toast appears
   - "Added to favorites!" message
   - Modal closes
3. Click "Favorites" tab
4. Verify:
   - Favorite appears in list
   - Route badge visible
   - Stop name shown

#### F. Test Favorites
1. Click on favorite in list
2. Verify:
   - ETA modal opens immediately
   - Current ETA data loads

#### G. Remove Favorite
1. Click trash icon on favorite
2. Verify:
   - Favorite removed from list
   - No error messages

### 4. Test Recent Searches

1. Search for route "3"
2. Search for route "5"
3. Click "Routes" tab
4. Verify:
   - "Recent Searches" section appears
   - Last 2 searches shown
   - Most recent at top

### 5. Console Verification

Open Chrome DevTools (F12):

```javascript
// Check storage
chrome.storage.local.get(null, console.log);

// Should show:
// - favorites: []
// - recentSearches: [...]
```

### 6. Network Verification

In DevTools → Network tab:

1. Search for a route
2. Verify API calls to:
   - `https://data.etabus.gov.hk/v1/transport/kmb/route/`
   - Response: JSON with route data

3. Click "View ETA"
4. Verify API calls to:
   - `https://data.etabus.gov.hk/v1/transport/kmb/eta/{stopId}/{route}/1`
   - Response: JSON with ETA data

### 7. UI/UX Verification

✅ Check:
- [ ] Smooth animations (pulse, hover effects)
- [ ] Glass-morphism effects visible
- [ ] Gradient backgrounds render correctly
- [ ] Custom scrollbar (thin, blue) appears
- [ ] Loading spinner works
- [ ] Toast notifications appear/disappear smoothly
- [ ] Modal opens/closes without issues
- [ ] Click outside modal to close works

### 8. Error Handling

#### Test Network Failure:
1. Open DevTools → Network
2. Set throttling to "Offline"
3. Try to search for a route
4. Verify:
   - Red error toast appears
   - User-friendly error message
   - Loading overlay hides

#### Test Invalid Route:
1. Search for route "99999"
2. Verify:
   - "Route 99999 not found" message
   - No crash or errors

### 9. Performance Check

1. Open route with many stops
2. Verify:
   - Loads within 2-3 seconds
   - No UI freezing
   - Smooth scrolling

### 10. Cache Verification

1. Search route "1"
2. Wait for data to load
3. Search route "1" again immediately
4. Verify:
   - Second search much faster (cached)
   - No duplicate network requests

## 🐛 Common Issues & Solutions

### Issue: Extension doesn't load
**Solution**: Check Chrome console for errors in `chrome://extensions/`

### Issue: API calls fail (CORS)
**Solution**: Verify manifest.json has correct host_permissions:
```json
"host_permissions": [
  "https://data.etabus.gov.hk/*"
]
```

### Issue: Autocomplete doesn't show
**Solution**: 
1. Open DevTools console
2. Check for JavaScript errors
3. Verify API response in Network tab

### Issue: ETA shows "N/A"
**Solution**: This is normal if no buses are currently scheduled

### Issue: Chinese text not showing
**Solution**: Check API response - KMB may only have English for some routes

## 📊 Expected API Response Examples

### Route List Response:
```json
{
  "type": "RouteList",
  "version": "1.0",
  "generated_timestamp": "2024-01-01T12:00:00+08:00",
  "data": [
    {
      "route": "1",
      "bound": "O",
      "service_type": "1",
      "orig_en": "STAR FERRY",
      "orig_tc": "尖沙咀碼頭",
      "dest_en": "CHUK YUEN ESTATE",
      "dest_tc": "竹園邨"
    }
  ]
}
```

### ETA Response:
```json
{
  "type": "ETA",
  "version": "1.0",
  "generated_timestamp": "2024-01-01T12:00:00+08:00",
  "data": [
    {
      "co": "KMB",
      "route": "1",
      "dir": "O",
      "service_type": 1,
      "seq": 1,
      "dest_tc": "竹園邨",
      "dest_en": "CHUK YUEN ESTATE",
      "eta_seq": 1,
      "eta": "2024-01-01T12:05:00+08:00",
      "rmk_tc": "",
      "rmk_en": "",
      "data_timestamp": "2024-01-01T12:00:00+08:00"
    }
  ]
}
```

## ✅ Test Checklist

Core Features:
- [ ] Extension loads without errors
- [ ] Popup opens with correct dimensions
- [ ] Route autocomplete works
- [ ] Route selection shows stops
- [ ] ETA modal displays correctly
- [ ] ETA auto-refresh works (30s)
- [ ] Add to favorites works
- [ ] Remove favorite works
- [ ] Recent searches tracked
- [ ] Tab switching works
- [ ] Loading states show/hide
- [ ] Error messages display

UI/UX:
- [ ] Gradient header visible
- [ ] LIVE badge animates
- [ ] Glass effects render
- [ ] Custom scrollbar shows
- [ ] Hover effects work
- [ ] Transitions smooth
- [ ] Toast notifications appear
- [ ] Modal backdrop blur works

API Integration:
- [ ] KMB API calls succeed
- [ ] Route data loads
- [ ] Stop data loads
- [ ] ETA data loads
- [ ] Caching works (30s)
- [ ] Error handling works

---

**Ready to test!** 🚀

Any issues? Check:
1. Chrome DevTools Console (F12)
2. Network tab for API calls
3. Extension error page (`chrome://extensions/`)
