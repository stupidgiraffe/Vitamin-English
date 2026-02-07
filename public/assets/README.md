# Assets Directory

This directory contains image assets for the Vitamin English School application.

## Current Files

### Placeholder Images (TO BE REPLACED)
All current images are **placeholders** and should be replaced with the actual Vitamin English School orange logo.

1. **orange-logo.png** - 200x200 PNG placeholder
   - Used in PDF header
   - Currently a simple orange circle with "V" 
   - **REPLACE with actual logo for production**

2. **favicon.ico** - 32x32 ICO file
   - Used as browser tab icon
   - **REPLACE with actual logo for production**

3. **favicon-32x32.png** - 32x32 PNG
   - Alternative favicon format
   - **REPLACE with actual logo for production**

4. **apple-touch-icon.png** - 180x180 PNG
   - iOS home screen icon
   - **REPLACE with actual logo for production**

## How to Replace Placeholders

### Step 1: Prepare Your Logo
Ensure you have the Vitamin English School orange logo as a high-resolution PNG file with transparent background (recommended 500x500px or larger).

### Step 2: Create Logo Sizes

#### For PDF (orange-logo.png):
```bash
# Resize to 200x200 for PDF header
convert your-logo.png -resize 200x200 orange-logo.png
```

#### For Favicons:
Use an online tool like https://realfavicongenerator.net/ or:

```bash
# Create 32x32 PNG favicon
convert your-logo.png -resize 32x32 favicon-32x32.png

# Create multi-size ICO file
convert your-logo.png -define icon:auto-resize=48,32,16 favicon.ico

# Create 180x180 Apple touch icon
convert your-logo.png -resize 180x180 apple-touch-icon.png
```

### Step 3: Replace Files
Simply overwrite the placeholder files in this directory with your generated files.

## Notes
- The PDF generation code supports both PNG and SVG formats for the logo
- If you have an SVG version of your logo, you can also save it as `orange-logo.svg` and the PDF generator will use it as a fallback
- Make sure your logo PNG files are compatible with PDFKit (avoid exotic compression or color profiles)
