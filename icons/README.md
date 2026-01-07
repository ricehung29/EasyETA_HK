# Icons

This folder contains the extension icons.

## Quick Setup

Since ImageMagick is not installed, you can:

1. **Option 1 - Use Node.js script (if Node is installed)**:
   ```bash
   npm install -g sharp-cli
   sharp -i icon.svg -o icon16.png resize 16 16
   sharp -i icon.svg -o icon48.png resize 48 48
   sharp -i icon.svg -o icon128.png resize 128 128
   ```

2. **Option 2 - Use browser**:
   - Open `create_icons.html` in your browser
   - It will automatically generate and download the 3 PNG files

3. **Option 3 - Use online converter**:
   - Go to https://www.aconvert.com/image/svg-to-png/
   - Upload `icon.svg`
   - Convert to 16x16, 48x48, and 128x128

4. **Option 4 - Temporary placeholders** (for development):
   Use simple colored squares until proper icons are ready.

The extension will work with any of these methods.
