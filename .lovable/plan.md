
# Trenutni problemi i predlog rešenja

## 1. `Unauthorized: No authorization header provided` (glavna greška u overlay-u)

**Šta se dešava**
- Stranica `/issuer/anchoring-queue` (i sve ostale `issuer.*`, `admin.*`, `earner.*`) je top-level ruta sa SSR uključenim, **van** `_authenticated/` foldera.
- Komponenta odmah na mount zove `listAnchorJobs` (zaštićenu serverFn). `useQuery` se pokreće pre nego što `supabase.auth.getSession()` u `auth-attacher.ts` ima sesiju iz `localStorage`.
- `attacher` šalje request bez `Authorization` headera → `requireSupabaseAuth` baci 401 → React baci runtime error overlay.
- Posle ~1s sesija se učita, polling na 8s prolazi i sve normalno radi (vidi se u session replay-u: "Anchor retry submitted / Confirmed").

**Plan popravke (minimalno invazivno)**
- U `src/routes/issuer.anchoring-queue.tsx`, pročitaj `useAuth()` i gate-uj `useQuery`:
  ```ts
  const { user, loading } = useAuth();
  useQuery({ ..., enabled: !loading && !!user });
  ```
- Isti pattern (samo gating) primeniti i u drugim `issuer.*` stranicama koje pucaju pri hard-refresh-u na zaštićenom URL-u: `issuer.index.tsx`, `issuer.credentials.tsx`, `issuer.microcredential-templates.*`, `issuer.requests.tsx`, `issuer.revocations.tsx`, `issuer.earners.tsx`, `issuer.staff.tsx`, `issuer.notifications.tsx`, `issuer.profile.tsx`, `issuer.settings.tsx`, `issuer.issue.*`.
- Mutacije (`retry`, `cancel`) ne diramo — one se zovu iz event handlera, sesija je tad sigurno tu.

**Alternativa (veći refactor, NE preporučujem sada)**: prebaciti sve zaštićene rute u `src/routes/_authenticated/`. Ispravnije po TanStack konvenciji, ali traži preimenovanje ~25 fajlova i ažuriranje svih `<Link>` putanja — radićemo zasebno ako poželiš.

## 2. Auto-enqueue kredencijala posle template anchor-a resetuje `attempts`

**Šta se dešava** (`src/lib/chain/worker.server.ts`, `processTemplateAnchor`)
Kad se template potvrdi, kod sve nepotvrđene kredencijale tog template-a vraća na `status='queued', attempts=0` — uključujući i one koji su trajno failovali (npr. nedostaje `learner_commitment`). To zaobilazi `MAX_ATTEMPTS=5` zaštitu i može da napravi beskonačne retry petlje.

**Plan popravke**
- `attempts=0` reset raditi samo za jobove čiji je `status='failed'` zbog "Chain not configured" greške (ili samo za `status='queued'`), a ostavljati `failed` jobove sa stvarnim greškama netaknute. Dodati `.eq("last_error", "Chain not configured")` ili `.eq("status", "queued")` u `update`.

## 3. `learnerCommitment` šema — sanity check (nije bug, samo provera)

- `anchor.functions.ts` koristi `commitmentHex(earner_id, secret)` (sha256). Ranije smo pominjali `learnerCommitmentKeccak` (keccak nad `earnerIdHash || credentialIdHash || secret`).
- Smart contract čuva proizvoljnih 32 bajta, tako da je opaque OK. Ali ako verifikacija na `/verify/:id` rekonstruše commitment, mora da koristi **istu** funkciju. Plan: pregledati `verify.$id.tsx` i `CredentialBlockchainVerificationCard.tsx` i potvrditi da rekonstrukcija odgovara onome što se piše u DB.

## 4. SSR + ostali toast-ovi

Nije greška u kodu — samo napomena: pošto su rute top-level SSR, prvi server render za `/issuer/*` URL-ove pokušava da hidruje sa praznom sesijom. Trenutno radimo data-fetch isključivo u komponenti (`useQuery`), ne u loader-u, pa SSR neće rušiti build. Ostaviti tako; opcija (1) rešava UX.

---

## Šta menjam (build mode)

1. Dodajem `enabled` gate na sve `useQuery` u `issuer.*` stranicama koje koriste protected serverFn.
2. U `worker.server.ts` ograničavam reset `attempts/status` samo na `Chain not configured` slučaj (ili samo `queued`).
3. Pregledam `verify.$id.tsx` i potvrđujem da je learner-commitment rekonstrukcija konzistentna; ako nije — uskladim.
4. Brzo testiram: hard-refresh `/issuer/anchoring-queue` (više nema 401 overlay-a), pa retry jednog joba (kao u tvom poslednjem testu — i dalje treba da završi "Confirmed").

Reci samo "ok" pa krećem.
