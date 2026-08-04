# Obnova kredencijala kroz zamenski kredencijal i supersede na blokčejnu

Trenutno „obnova" samo menja `expires_at` na postojećem kredencijalu. Pošto je originalni rok važenja već upisan u nepromenljiv zapis na blokčejnu, taj zapis i baza se razilaze. Nova logika izdaje **novi kredencijal** sa novim rokom, sidri ga, i tek kada je to potvrđeno — original se označava kao zamenjen (superseded) i off-chain i on-chain.

## Odluke (potvrđene)

- Zamenski kredencijal se **ne** šalje nosiocu na prihvatanje — izdaje se i sidri automatski.
- Ako original nikada nije bio sidren, i dalje se kreira zamena (bez supersede transakcije, original se off-chain označava kao zamenjen).
- Na javnoj stranici originala prikazuje se neutralna poruka i link ka zameni **samo** ako je zamena javno deljena.

## Tok obnove

```text
1. Izdavalac klikne "Obnovi"  ->  kreira se zapis o obnovi (idempotentan ključ)
2. Kreira se novi kredencijal (novi UUID, novi rok, isti šablon/verzija)
   - novi VC dokument, novi SHA-256 heš, nova tajna nosioca, nova obaveza (commitment)
   - veza: novi.renewed_from_id = original.id
3. Zamena se sidri (issueCredential)  ->  čeka se potvrda
4. Tek po potvrdi: supersedeCredential(original, zamena)
5. Po potvrdi supersede transakcije:
   - original -> lifecycle "superseded", superseded_by_id = zamena
   - upisuje se tx heš, broj bloka, vreme
   - obaveštenja nosiocu, upisi u dnevnik izmena
Ako korak 3 ili 4 padne: original ostaje AKTIVAN, zamena ostaje aktivna,
greška se pamti, moguć je ručni ponovni pokušaj. Nikada se ne prikazuje
lažno da je original zamenjen na blokčejnu.
```

## Izmene u bazi (migracija)

Nova tabela `credential_renewals` — jedan red po operaciji obnove:

- `original_credential_id`, `replacement_credential_id`
- `requested_by`, `requested_at`, `replacement_anchored_at`, `completed_at`
- `state`: `replacement_pending` | `replacement_anchored` | `supersede_pending` | `supersede_failed` | `completed`
- `supersede_tx_hash`, `supersede_block_number`, `supersede_chain_status`, `last_error`, `attempts`
- jedinstveni indeks na `original_credential_id` za nezavršene obnove (sprečava duple obnove i dvostruke klikove)
- GRANT + RLS: čitanje za članove organizacije izdavaoca i administratore platforme; upis samo preko servera

Postojeća polja `credentials.renewed_from_id` i `credentials.superseded_by_id` se ponovo koriste — nova polja se ne uvode.

Redovi u `credential_anchor_jobs` dobijaju novu operaciju `supersede_credential` sa zasebnom obradom.

## Izmene u kodu

- `src/lib/chain/bloxberg.server.ts` — nova serverska funkcija `submitSupersedeCredential(originalId, replacementId)`: ista konfiguracija potpisnika i registra, ista normalizacija UUID→bytes32, provera preko `getCredential` da oba zapisa postoje, da su aktivna i da imaju istog izdavaoca na lancu; čeka jednu potvrdu; dekodira greške ugovora. Ako je original već `Superseded` — tretira se kao uspeh samo kada se poklapa sa planiranom zamenom, inače eksplicitan konflikt.
- `src/lib/chain/renewal.server.ts` (novo) — kreiranje zamenskog kredencijala i obrada supersede posla; koristi postojeće pomoćne funkcije (`buildVcJson`, `canonicalJson`, `sha256Hex`, `randomSecretHex`, `learnerCommitmentKeccak`, `templateRefKeccak`, `toBytes32Hex`) bez dupliranja logike.
- `src/lib/chain/worker.server.ts` — zasebna grana `processCredentialSupersede` (ne prolazi kroz redovno sidrenje).
- `src/lib/chain/anchor.functions.ts` — `renewCredential` se prepisuje: više ne menja `expires_at`, već pokreće novi tok; dodaje se `retryRenewalSupersede` za ručni ponovni pokušaj. Zadržavaju se iste provere ovlašćenja kao kod izdavanja (samo sopstvena organizacija).
- `src/routes/issuer.credentials.tsx` — dijalog obnove prikazuje da se izdaje zamenski kredencijal, status obnove i dugme za ponovni pokušaj kada supersede padne.
- `src/lib/chain/verify-public.server.ts` + `src/components/PublicChainVerificationPanel.tsx` + `src/routes/verify.$id.tsx` — za original: status „zamenjen" iz baze i sa lanca, neutralna poruka i link ka zameni ako je javno deljena; za zamenu: aktivna, novi rok, napomena da zamenjuje raniji kredencijal. Interni ID-jevi se ne otkrivaju kada deljenje nije uključeno.
- Prevodi u `src/i18n/locales/{en,sr}/…` za sve nove poruke i statuse.

## Obaveštenja i dnevnik

Upisi u `audit_log`: zatražena obnova, kreirana zamena, zamena sidrena, original zamenjen, neuspeh/ponovni pokušaj. Obaveštenja nosiocu: nova verzija kredencijala je izdata i obnova je završena.

## Testovi

`src/lib/chain/__tests__/renewal.server.test.ts`: uspešna obnova; neuspeh sidrenja zamene; neuspeh supersede transakcije; ponovni pokušaj posle neuspeha; duplirani zahtev za obnovu; original već opozvan; original već zamenjen; zamena nije aktivna; različite adrese izdavaoca na lancu; RPC nedostupan; original nikad sidren; javna verifikacija originala i zamene.

## Isporuka na kraju

Lista izmenjenih fajlova, migracija, tačan redosled stanja, trag ruta → serverska funkcija → izdavanje zamene → sidrenje → supersede ugovor → baza, potvrda da se `expiresAt` originala nikada ne menja na lancu, potvrda da se `supersedeCredential` poziva tek posle potvrde zamene, i rezultati testova.
