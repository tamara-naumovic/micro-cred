# Automatska odjava nakon 45 minuta neaktivnosti

## Cilj
Prijavljeni korisnik koji 45 minuta ne komunicira sa platformom automatski se odjavljuje i vraća na stranicu za prijavu, uz kratko upozorenje pre isteka.

## Ponašanje
- Tajmer neaktivnosti: 45 minuta.
- Aktivnost koja resetuje tajmer: pomeraj miša, klik, taster, skrol, dodir, kao i promena stranice u aplikaciji.
- Po isteku: tiho se odjavljuje, čisti keš podataka i preusmerava na `/login` sa porukom da je sesija istekla zbog neaktivnosti.
- Radi i kada je korisnik u više tabova: poslednja aktivnost se deli preko `localStorage`, pa aktivnost u jednom tabu održava sesiju u svim.
- Ako je tab bio uspavan/zatvoren pa se vrati, proverava se vreme poslednje aktivnosti i odjava se izvršava odmah ako je isteklo.
- Odnosi se samo na prijavljene korisnike; javne stranice (javni profil, `/verify/...`) nisu pogođene.

## Šta je potrebno za implementaciju
Nije potrebna nikakva izmena baze ni novi servis — sve se rešava na klijentu nad postojećim auth slojem.

1. Novi hook `src/lib/use-idle-logout.ts`
   - konstanta: `IDLE_MS = 45 * 60 * 1000`
   - osluškuje `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `visibilitychange` uz throttle (npr. upis najviše jednom u 15s)
   - čuva `credseal:lastActivity` u `localStorage`; `storage` event sinhronizuje tabove
   - jedan interval (svakih ~15s) upoređuje trenutno vreme sa poslednjom aktivnošću i pokreće odjavu

2. Odjava koristi postojeći tok
   - `queryClient.cancelQueries()` → `queryClient.clear()` → `supabase.auth.signOut()` → `setActiveUser(null)` → `navigate({ to: "/login", search: { reason: "idle" }, replace: true })`
   - logika se izdvaja u jednu funkciju koju koriste i meni „Odjava“ i automatska odjava

3. Uključivanje hook-a
   - poziva se u `AppSidebarLayout` (renderuje se samo za prijavljene korisnike u `/earner`, `/issuer`, `/admin`), aktivan samo kada postoji `activeUser`

4. Poruka nakon odjave
   - na `/login` prikaz poruke kada je `reason=idle`

5. Lokalizacija (EN/SR)
   - novi ključevi u `common.json`: `idle.expired`

## Napomena
Ovo je odjava na strani klijenta (UX + brisanje lokalne sesije). Sam token Lovable Cloud auth sloja i dalje ima svoj rok; ako je potrebno strogo serversko ograničenje trajanja sesije, to se dodatno podešava u postavkama autentifikacije i može se uraditi kao sledeći korak.
