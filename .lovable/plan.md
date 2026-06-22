## Cilj

Na `/issuer/credentials` prikazati datum isteka i omogućiti produženje (renewal) već izdatih kredencijala kroz iste statusne korake kao izdavanje, ali bez koraka prihvatanja od strane earner-a.

## 1. Kolona "Expires" u tabeli

Dodati novu kolonu nakon "Issued":
- ako `expiresAt` postoji → `new Date(c.expiresAt).toLocaleDateString()` + suptilan badge "Expired" ako je u prošlosti
- ako ne postoji → `Does not expire` (text-muted-foreground)

## 2. Akcija "Renew" u koloni Actions

Za kredencijale sa `lifecycle === "issued"` i postojećim `expiresAt`, dodati dugme **Renew expiry** (ikona `CalendarClock`). Klik otvara `RenewDialog`.

## 3. RenewDialog — workflow sa 4 statusa

Dialog vodi izdavaoca kroz 4 koraka koji preslikavaju lifecycle iz `issuer.requests` (`LIFECYCLE_STAGES`), ali sa lokalnim state-om jer se renewal ne provlači kroz `applications`:

```text
1. in_review               [Advance to evidence collected]
2. evidence_collected      [Advance to verified by provider]
3. verified_by_provider    [Issue & sign  → otvara polje za novi expiry date]
4. issued (renewed)        zatvara dialog
```

UI: `LifecycleTimeline`-style stepper na vrhu + glavno dugme za sledeći korak. Na poslednjem koraku prikazuje se `Input type="date"` (default = trenutni `expiresAt`) i dugme **Issue & sign**.

Kredencijal ostaje u `lifecycle: "issued"` tokom celog procesa (status se ne menja u bazi do finalnog koraka) — koraci 1–3 su samo UI/timeline, bez writes u DB (osim opcionog audit eventa). Finalni korak poziva novu server funkciju.

## 4. Server funkcija `renewCredential`

Nova funkcija u `src/lib/chain/anchor.functions.ts`:
- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`
- input: `{ credentialId, newExpiryDate }`
- permission check: issuer_admin org-a, platform_admin, ili template assignee (isti pattern kao postojeći `resendCredential`)
- update `credentials.expires_at = newExpiryDate`
- ako je kredencijal bio `expired` → lifecycle nazad na `issued`
- upiše audit_log event ("renewed credential expiry") i notifikaciju za earner-a ("Your credential expiry has been extended to …")
- **bez** menjanja `credential_lifecycle` na `pending_earner_acceptance`, **bez** novog blockchain anchor poziva (kredencijal već postoji on-chain; produženje je off-chain metadata update)
- vraća osvežen objekat

Klijent zatim poziva `loadAll()` iz `useStore` da refresh-uje listu, plus `toast.success("Expiry extended")`.

## 5. Tehnički detalji

- Tipovi: `IssuedCredential.expiresAt` već postoji.
- Filter za "Expired" lifecycle u dropdown-u ostaje nepromenjen.
- Reuse `LIFECYCLE_STAGES` konstanti iz `@/lib/types` za stepper labele (samo `in_review`, `evidence_collected`, `verified_by_provider`, `issued`).
- Dugme **Renew** se ne prikazuje ako `expiresAt` ne postoji (jer "does not expire" nema šta da produži). Ako želiš da se omogući i tada (da postavi prvi expiry), reci pa ću dodati.

## Fajlovi

- `src/routes/issuer.credentials.tsx` — kolona Expires, dugme Renew, nova `RenewDialog` komponenta
- `src/lib/chain/anchor.functions.ts` — `renewCredential` server fn
