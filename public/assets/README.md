# Assets Directory

This directory contains image assets for the Vitamin English School application.

## Required Files

### Orange Logo
The orange logo should be placed here in the following formats:

1. **orange-logo.png** - High-resolution PNG (recommended 500x500px or larger, transparent background)
   - Used in PDF header
   - Used as favicon source

2. **favicon.ico** - Multi-size ICO file (16x16, 32x32, 48x48)
   - Generated from orange-logo.png
   - Used as browser tab icon

3. **favicon-32x32.png** - 32x32 PNG
   - Alternative favicon format
   - Better browser support

4. **apple-touch-icon.png** - 180x180 PNG
   - iOS home screen icon
   - Apple device support

## Converting Logo to Favicon

If you have the orange logo PNG, you can convert it to favicon formats using:
- Online tools like https://realfavicongenerator.net/
- ImageMagick: `convert orange-logo.png -resize 32x32 favicon-32x32.png`
- For ICO: `convert orange-logo.png -define icon:auto-resize=48,32,16 favicon.ico`
