## Cilj

Uvesti onboarding iskustvo za earner-a:
1. **Guided tour** pri prvom logovanju — pop-up koraci sa highlight-om delova dashboard-a i kratkim opisima.
2. **Manual** stranica iznad Settings u sidebar-u, koja objašnjava platformu i linkuje ka odgovarajućim sekcijama.

## 1. Guided tour (prvi login)

**Biblioteka:** `driver.js` (lagano, ~5KB, bez React-deps, radi sa selektorima — savršeno za TanStack Start). Alternativa `react-joyride` je teža i kapriciozna sa SSR; driver.js je sigurniji izbor.

**Triggering:**
- Flag `earner_tour_completed` u `localStorage` (po user id-u: `tour:earner:{userId}`).
- Na `/earner` (dashboard) `useEffect` proverava flag → ako nije postavljen, pokreće tour i postavlja flag po završetku/preskakanju.
- Dugme "Restart tour" na Manual stranici i u sidebar footer-u (opciono, mali link) za ponovno pokretanje.

**Koraci tour-a (na `/earner` dashboard-u):**
1. Welcome modal (bez highlight-a) — kratka dobrodošlica.
2. Highlight sidebar "My Credentials" — gde vidiš sve svoje izdate kredencijale.
3. Highlight "Applications" — status aplikacija koje si poslao.
4. Highlight "Apply for Credential" — kako da apliciraš za novi kredencijal.
5. Highlight "Public Profile" — javni profil koji možeš podeliti.
6. Highlight "Notifications" — obaveštenja o promenama statusa.
7. Highlight "Manual" link — gde uvek možeš naći detaljnija uputstva.
8. Highlight glavnih kartica/sekcija na samom dashboard-u (stats, recent credentials itd. — prilagoditi stvarnoj strukturi `earner.index.tsx`).
9. Završni korak — "Done, srećno!" + dugme "Open Manual".

Svaki korak: kratak naslov + 1-2 rečenice opisa (srpski, kratko). Dugmad: "Next", "Back", "Skip tour".

Za selektore: dodati `data-tour="..."` atribute na sidebar linkove i ključne dashboard sekcije.

## 2. Manual stranica

**Ruta:** `src/routes/earner.manual.tsx` → URL `/earner/manual`.

**Sidebar:** ubaciti stavku **iznad** Settings u `EARNER_NAV` u `src/components/layouts/AppSidebarLayout.tsx`:
```
{ to: "/earner/manual", label: "Manual", icon: BookOpen }
```

**Struktura stranice (sekcije sa naslovima, opisom i `<Link>` ka relevantnim rutama):**
- **Getting Started** — kratak pregled platforme, dugme "Restart guided tour".
- **Dashboard** (`/earner`) — šta vidiš na početnoj.
- **My Credentials** (`/earner/credentials`) — pregled, detalji, verifikacija, blockchain proof, deljenje.
- **Applications** (`/earner/applications`) — praćenje statusa, šta znače statusi (submitted, in review, evidence collected, verified, issued, rejected), accept rejection / edit & resend flow, renew expiry.
- **Apply for Credential** (`/earner/apply`) — kako pretražiti template, poslati aplikaciju, šta priložiti kao evidence.
- **Public Profile** (`/earner/profile`) — kako urediti i podeliti.
- **Notifications** (`/earner/notifications`) — tipovi i upravljanje.
- **Settings** (`/earner/settings`) — nalog, security.

Svaka sekcija: H2 + paragraf + `<Link>` „Open …".

## Tehnički detalji

**Fajlovi:**
- `package.json` — dodati `driver.js` (`bun add driver.js`).
- `src/lib/tour/earnerTour.ts` — nova; definicija koraka + `startEarnerTour(force?: boolean)` helper koji upravlja localStorage flag-om.
- `src/routes/earner.index.tsx` — `useEffect` koji poziva `startEarnerTour()`; dodati `data-tour` atribute na ključne sekcije.
- `src/components/layouts/AppSidebarLayout.tsx` — dodati Manual nav item iznad Settings za earner-a; dodati `data-tour` atribute na svaki earner nav link.
- `src/routes/earner.manual.tsx` — nova stranica sa sekcijama i dugmetom "Restart tour".
- `src/styles.css` (ili globalni) — import `driver.js/dist/driver.css` (preko routes/__root.tsx ili direktan import u tour modulu).

**State:** localStorage ključ `tour:earner:{userId}` = `"1"` kada je završen. Ako user-a nema (nije ulogovan), tour se ne pokreće.

**SSR:** `driver.js` se diže samo unutar `useEffect` (client-only), pa nema SSR problema.

## Out of scope (za sada)
- Tour za issuer i admin (može slično u narednom koraku).
- Persistovanje flag-a u backend (localStorage je dovoljan za sada).
- Lokalizacija (sve na srpskom; i18n se može uvesti kasnije).
