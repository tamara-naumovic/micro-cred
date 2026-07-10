# Rebrand MicroCred → CredSeal

Rename the platform to **CredSeal** and replace the generic shield/check icon with a distinctive abstract "MC" mark. Keep the header clean and minimal.

## Scope

Header branding only (logo mark, wordmark, subtitle). No changes to routes, business logic, or content pages beyond text swaps for the platform name where it appears in navigation/footer/meta.

## 1. New logo mark (SVG component)

Create `src/components/BrandMark.tsx` — an inline SVG component (no raster asset needed for the navbar; scales cleanly, themable).

Design concept: abstract "MC" monogram that reads as a stylized credential card + verification seal.

- Rounded-square container (16px radius on 40px) suggesting a credential card.
- Inside: an "M" formed by two upward strokes with a subtle notch at the top, joined to a "C" arc that wraps the right side — the C doubles as a verification tick and as an open link (blockchain node connector).
- Three small dots along the bottom-right of the C, evoking chained blocks / decentralised nodes.
- Fill: soft gradient `#2563EB → #8B7CF6 → #5BC8A5` (diagonal, top-left to bottom-right).
- Strokes: white, rounded caps and joins, ~2.5px stroke on 40px viewbox.
- Works at 16px (favicon), 40px (navbar), and 128px+ (app icon) because geometry is simple with generous stroke weight.

Props: `size?: number` (default 36), `className?: string`.

## 2. Header wordmark update

Edit `src/components/layouts/PublicLayout.tsx`:

- Replace the `<div className="flex h-9 w-9 …"><ShieldCheck /></div>` block with `<BrandMark size={36} />`.
- Wordmark:
  - Line 1: `CredSeal` — `font-display font-semibold text-base`, color `text-foreground` (deep navy via existing `--foreground` token).
  - Line 2: `VERIFIED SKILLS · TRUSTED CREDENTIALS` — `text-[10px] uppercase tracking-widest text-muted-foreground`.
- Remove the now-unused `ShieldCheck` import.

## 3. Design tokens (light-mode only touch-up)

Edit `src/styles.css` `:root` to align the palette with the brand spec (dark mode untouched):

- `--primary` → oklch equivalent of `#2563EB` (deep blue).
- `--purple` → oklch equivalent of `#8B7CF6` (lilac).
- `--success` → oklch equivalent of `#5BC8A5` (mint).
- `--foreground` → oklch equivalent of `#111827` (near-black navy for text).
- `--background` → oklch equivalent of `#F7FAFC` (soft off-white).
- Update `--gradient-soft` to a blue→lilac→mint blend so the hero backdrop matches the new brand.

Existing semantic tokens (`--ring`, `--sidebar-primary`, `--chart-*`) already reference these variables, so they update automatically.

## 4. Platform name swaps

Rename "MicroCred" → "CredSeal" only in user-facing brand surfaces (leave code identifiers, folder names, and DB values alone):

- `src/components/layouts/PublicLayout.tsx` — nav wordmark (already covered above) and footer text.
- `src/routes/__root.tsx` — `head()` meta: `title`, `description`, `og:title`, `og:description`, `twitter:title`, `twitter:description`.
- `src/routes/index.tsx` — `head()` meta title/description and any body copy referring to "MicroCred" by name.

Sidebar app layout (`AppSidebarLayout.tsx`) will be checked for the same brand string and updated if present.

## 5. Favicon

Generate a matching favicon PNG from the same mark (solid rounded-square background so it reads at 16×16), save to `public/favicon.png`, register in `__root.tsx` `links`, and delete the default `public/favicon.ico`.

## Out of scope

- No changes to i18n JSON files (they contain no "MicroCred" brand string in current context; will verify during build, and only touch en/sr common bundles if the literal appears).
- No dark-mode palette change.
- No changes to issuer/earner/admin dashboards, routes, DB, or business rules.
- No new marketing copy beyond the subtitle swap.

## Files changed

- **new** `src/components/BrandMark.tsx`
- **new** `public/favicon.png` (+ delete `public/favicon.ico`)
- **edit** `src/components/layouts/PublicLayout.tsx`
- **edit** `src/components/layouts/AppSidebarLayout.tsx` (if brand string present)
- **edit** `src/routes/__root.tsx` (favicon link + meta)
- **edit** `src/routes/index.tsx` (meta + body brand references)
- **edit** `src/styles.css` (palette + gradient)
