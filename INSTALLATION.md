# EasyETA_HK Installation Guide

## Prerequisites

- Google Chrome browser (v88 or later)
- Basic understanding of Chrome extensions

## Step-by-Step Installation

### 1. Generate Extension Icons

Before loading the extension, you need to generate the icon files:

**Option A - Use Browser (Easiest)**:
1. Open `icons/create_icons.html` in Chrome
2. The browser will automatically download 3 PNG files
3. Move `icon16.png`, `icon48.png`, and `icon128.png` to the `icons/` folder

**Option B - Use Online Converter**:
1. Go to https://www.aconvert.com/image/svg-to-png/
2. Upload `icons/icon.svg`
3. Convert to 16x16, 48x48, and 128x128 sizes
4. Save the files in the `icons/` folder

### 2. Load Extension in Chrome

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle switch in top right)
3. Click **"Load unpacked"** button
4. Navigate to and select the `EasyETA_HK` folder
5. The extension should now appear in your extensions list

### 3. Verify Installation

You should see:
- ✅ EasyETA_HK in your extensions list
- ✅ Extension icon in Chrome toolbar
- ✅ No errors in the extension card

### 4. Pin the Extension (Optional)

1. Click the puzzle piece icon in Chrome toolbar
2. Find "EasyETA_HK"
3. Click the pin icon to keep it visible

## First Launch

1. Click the EasyETA_HK icon in your toolbar
2. The popup should open showing the search interface
3. Right-click the icon → Options to open the settings page

## Troubleshooting

### "Manifest file is missing or unreadable"
- Make sure you selected the correct folder (should contain `manifest.json`)
- Check that `manifest.json` exists in the root directory

### "Could not load icon"
- Generate the icon PNG files (see Step 1)
- Verify icon files exist in `icons/` folder

### Extension loads but doesn't work
- Open Chrome DevTools (F12) on the popup
- Check Console for errors
- Verify all script files are present

### Service worker errors
- Go to `chrome://extensions/`
- Click "Errors" button on the EasyETA_HK card
- Check background service worker errors

## Next Steps

After successful installation:
1. Read [GETTING_STARTED.md](docs/GETTING_STARTED.md) for usage guide
2. Create your first notification rule
3. Add your favorite bus stops

## Updating the Extension

When code changes are made:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the EasyETA_HK card
3. The extension will reload with your changes

## Uninstalling

1. Go to `chrome://extensions/`
2. Click "Remove" on the EasyETA_HK card
3. Confirm removal

Note: All your data (rules, favorites) is stored locally and will be deleted on uninstall. Export your data first if you want to keep it!

---

For more help, see [GETTING_STARTED.md](docs/GETTING_STARTED.md)
