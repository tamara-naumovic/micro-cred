# Fix WinAnsi encoding error in credential PDF

## Problem
`pdf-lib` standard fonts (Helvetica) use WinAnsi encoding, which cannot encode characters like `ć` (0x0107), `š`, `ž`, `č`, `đ`, Cyrillic, etc. The "Download complete package" and "Download PDF" actions throw `WinAnsi cannot encode "ć"` and fail.

This is a font-embedding problem inside our PDF builder — Lovable platform itself runs UTF-8 fine; we just have to embed a real Unicode font in the PDF.

## Solution
Embed Noto Sans (Regular + Bold + Italic) as a TTF asset and register it via `@pdf-lib/fontkit`. Replace all `StandardFonts.Helvetica*` usages.

## Steps

1. **Add dependency**: `bun add @pdf-lib/fontkit`.
2. **Add font files** as server assets:
   - `src/lib/evidence/fonts/NotoSans-Regular.ttf`
   - `src/lib/evidence/fonts/NotoSans-Bold.ttf`
   - `src/lib/evidence/fonts/NotoSans-Italic.ttf`
   
   Downloaded from Google Fonts (Noto Sans, OFL license). Imported as `?arraybuffer` so Vite bundles them into the Worker.
3. **Update `src/lib/evidence/builders.server.ts`**:
   - Import `fontkit` and the three TTF buffers.
   - In `buildCredentialPdf`, call `doc.registerFontkit(fontkit)` after `PDFDocument.create()`.
   - Replace `doc.embedFont(StandardFonts.Helvetica*)` with `doc.embedFont(notoRegularBytes, { subset: true })` and analogous for Bold/Italic. Subsetting keeps the PDF small (~30–60 KB added).
   - Remove the now-unused `StandardFonts` import.
4. **Sanity-check text drawing**: `wrapText` is char-count based, so widths may shift slightly with Noto vs Helvetica — acceptable, layout is forgiving.
5. **Worker compatibility check**: `@pdf-lib/fontkit` is pure JS and works in Cloudflare Workers. TTFs imported via `?arraybuffer` are inlined at build time — no runtime fs access.

## Verification
- Issue a credential whose title/earner/issuer name contains `ć`, `š`, `đ`.
- Download PDF and ZIP — both succeed, characters render correctly.
- Confirm previous ASCII-only credentials still render unchanged.

## Out of scope
- Cyrillic-only or CJK glyphs (Noto Sans Latin covers all Central/Eastern European Latin; if Cyrillic is needed later, swap to `NotoSans` full or add `NotoSansSC`).
- JSON / receipt files are already UTF-8 — no change needed there.
