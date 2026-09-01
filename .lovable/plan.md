# Dokument: Zašto je CredSeal EBSI-ready

Cilj: jedan MD dokument koji objašnjava kako je platforma pripremljena za buduću integraciju sa EBSI-jem (European Blockchain Services Infrastructure), sa osloncem na stvarnu implementaciju, bez preuveličavanja (platforma trenutno nije EBSI-konformna, već EBSI-spremna).

## Šta se kreira

Novi fajl: `/mnt/documents/CredSeal_EBSI_readiness.md` (srpski, engleski tehnički termini).

## Struktura dokumenta

1. **Sažetak** — šta „EBSI-ready" znači u ovom kontekstu: model podataka, formati i tokovi već prate W3C VC / EBSI logiku, dok je sidrenje trenutno na Bloxberg mreži; prelazak na EBSI zahteva zamenu trust i registry sloja, ne redizajn aplikacije.
2. **Šta je EBSI i šta zahteva od izdavaoca** — kratko: DID-ovi (did:ebsi), Trusted Issuers Registry, W3C Verifiable Credentials, Verifiable Data Registry, status/revocation liste, wallet-based prezentacija.
3. **Dokazi spremnosti u trenutnoj implementaciji** — svaka tvrdnja vezana za konkretan deo koda:
   - kanonski W3C VC JSON sa `@context` W3C + Europass i tipovima `VerifiableCredential` / `MicroCredential` (`src/lib/chain/vc.ts`)
   - stabilni identifikatori `urn:microcred:`, `urn:issuer:`, `urn:earner:`, `urn:template:` kao mesta za buduće DID-ove
   - polja `ebsi_status`, `ebsi_did`, `ebsi_vc_id`, `ebsi_tx_hash` u tabeli `credentials` (već postoje kao rezervisani slotovi)
   - EU/Europass metapodaci na šablonu: `qaType`, `supervisionType`, `stackabilityType`, `ects`, `level`, `outcomes`, `assessment`, `participation`, `prerequisites`
   - deterministički SHA-256 hash kanonskog payload-a + learner commitment (privacy-preserving: lični podaci nikad ne idu na lanac)
   - lifecycle statusi (`issued`, `revoked`, `superseded`, `expired`) koji se preslikavaju na EBSI status/revocation model
   - apstrahovan anchor sloj (queue + worker + `bloxberg.server.ts`) koji se menja kao adapter
   - javna verifikacija bez naloga (`/verify/$id`) kao ekvivalent verifier toka
4. **Mapiranje CredSeal → EBSI** — tabela: element CredSeal-a → EBSI koncept → status (spremno / potrebna izmena).
5. **Šta nedostaje za punu EBSI konformnost** — pošteno navedeno: did:ebsi registracija izdavaoca u TIR, kriptografsko potpisivanje VC-a (JWT/JSON-LD proof, trenutno se hešuje a ne potpisuje), Status List 2021, OID4VCI/OID4VP izdavanje u wallet, akreditacije (VCs za akreditaciju izdavaoca), konformnosni testovi.
6. **Plan migracije u fazama** — Faza 1: DID i ključevi; Faza 2: potpisani VC-ovi; Faza 3: EBSI registry umesto Bloxberg ugovora (ili paralelno); Faza 4: wallet izdavanje i prezentacija; Faza 5: konformnosni testovi i produkcija.
7. **Uticaj na arhitekturu** — koje datoteke/slojevi se menjaju, a koji ostaju netaknuti (UI, RLS, uloge, i18n ostaju isti).
8. **Rizici i pretpostavke** — dostupnost EBSI okruženja za nedržavne izdavaoce, upravljanje ključevima, pravni okvir.

## Metod izrade

Sadržaj se izvodi iz koda (`src/lib/chain/vc.ts`, `hash.ts`, `anchor.functions.ts`, `bloxberg.server.ts`, `verify-public.*`, `src/lib/types.ts`, šema `credentials`) i postojećih izveštaja o blockchain integraciji, uz jasno razdvajanje „već implementirano" od „potrebno za EBSI".
