# Kontekstni MD fajl za sledeći AI

Cilj: jedan samostalan dokument koji sledeći AI može da učita kao kompletan kontekst o CredSeal aplikaciji, kako bi mogao da piše tehničku dokumentaciju i objašnjava korisničke tokove bez pristupa kodu.

## Šta se kreira

Novi fajl: `/mnt/documents/CredSeal_AI_kontekst.md` (srpski, sa engleskim tehničkim terminima).

## Sadržaj dokumenta

1. **Kako koristiti ovaj fajl** — kratko uputstvo za AI: šta je izvor istine, koja terminologija se koristi (mikrokredencijal, Izdavalac, Zaposleni, Nosilac, Administrator platforme), da se ne izmišljaju funkcionalnosti van popisanih.
2. **Pregled proizvoda** — svrha platforme, ključne vrednosti (verifikabilni mikrokredencijali usidreni na Bloxberg blockchain), ciljne grupe.
3. **Tehnološki stack i arhitektura** — TanStack Start v1 (React 19, Vite 7), server funkcije vs. javne API rute, Tailwind v4, backend (Postgres + auth + storage), Bloxberg RPC + smart ugovori (CredentialRegistry, TemplateRegistry), edge runtime ograničenja.
4. **Uloge i prava** — earner, issuer (admin/staff, moguća dvojna uloga), platform admin; RoleGuard, izolacija po organizaciji, `can_view_profile`, tenant-scoping blockchain akcija.
5. **Mapa stranica po ulozi** — tabela: ruta → uloga → svrha → glavne akcije, za svih ~35 ruta (javne, earner, issuer, admin).
6. **Domenski model** — glavni entiteti i njihova polja/statusi (šablon, prijava, izdati kredencijal, revokacija, obnova, notifikacija, anchor job), lifecycle vrednosti i njihova značenja.
7. **Ključni user flow-ovi** — korak-po-korak, sa akterima i sistemskim posledicama:
   - prijava earner-a na šablon → pregled → evidence collected → verified → izdavanje → prihvatanje/odbijanje
   - direktno i grupno (CSV) izdavanje
   - revokacija na lancu
   - obnova kroz zamenski kredencijal + supersede
   - javna verifikacija (/verify/$id) i deljeni javni profil (/profile/$token)
   - kreiranje naloga (pojedinačno i grupno), dodela uloga i šablona
8. **Blockchain model** — šta se hešuje i šta se nikad ne stavlja na lanac, commitment shema, redovi/statusi anchor-a, ručna read-only verifikacija i upozorenja o nekonzistentnosti DB↔lanac.
9. **i18n pravila** — EN default + SR, namespace organizacija, prevod ključnih termina.
10. **Bezbednost i privatnost** — RLS princip, GRANT pravila, poznati otvoreni rizici (npr. javni pristup QA dokumentima), idle logout 45 min.
11. **Poznata ograničenja i legacy delovi** — npr. `chain_anchor_jobs` kao legacy, mock/store slojevi.
12. **Indeks postojeće dokumentacije** — lista već generisanih fajlova u `/mnt/documents` sa opisom šta svaki pokriva, da AI zna gde da traži detalje.

## Metod izrade

Sadržaj se izvodi iz koda (rute, `src/lib/types.ts`, store, chain moduli, i18n) i iz postojećih izveštaja (tehnička arhitektura v2, RLS inventar, baza v2, blockchain integracija), uz proveru da tvrdnje odgovaraju trenutnoj implementaciji.
