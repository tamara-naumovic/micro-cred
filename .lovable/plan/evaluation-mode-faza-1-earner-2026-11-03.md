# Evaluation Mode — Faza 1 (Earner)

Izolovan modul za vođeno testiranje i merenje upotrebljivosti. Ne menja postojeće procese, dozvole, životni ciklus kredencijala ni blockchain. Podrazumevano isključen za sve naloge.

## Šta korisnici dobijaju

**Administrator platforme** — nova stranica *Administracija → Evaluacija*:
- kreiranje kampanje (naziv, verzija scenarija, početak, opcioni kraj);
- pretraga Earner naloga i uključivanje/isključivanje pojedinačno;
- pregled statusa poziva i pristanka, poslednje aktivnosti;
- pojedinačni pregled pokušaja (status, ishod, aktivno vreme, Help, pomoć nastavnika, komentari);
- agregat po scenariju (započeto, završeno, preskočeno, verifikovan/samoprijavljen uspeh, medijana vremena, učestalost pomoći);
- CSV izvoz: participants, scenario_attempts, events, summary — samo pseudonimni ID, bez imena, emaila i sadržaja kredencijala.

**Pozvani Earner:**
- pri sledećem ulasku jednokratni modal: svrha, vrste podataka, dobrovoljnost → *Prihvatam / Kasnije / Ne želim*;
- posle pristanka diskretan indikator u zaglavlju „Testiranje u toku“ koji otvara bočni panel sa E1–E11 (status, Započni / Nastavi / Ponovi / Preskoči, napredak „4/11 obrađeno“);
- mali sklopivi panel aktivnog zadatka: situacija, koraci, kriterijum uspeha, *Pauziraj, Preskoči, Help, Završi*, opcija „Smatram da sam završio/la“ i opcioni komentar;
- Help otvara uputstvo za earnere (beleži se), uz posebna dugmad „Potrebna mi je pomoć nastavnika“ / „Nastavnik mi je pomogao“;
- *Završi testiranje* u bilo kom trenutku, sa rezimeom i opcionim linkom ka USE upitniku.

**Ostali korisnici** ne vide ništa i ništa se ne beleži.

## Pravila merenja
- Praćenje samo ako: nalog uključen + pristanak prihvaćen + postoji aktivan pokušaj.
- Status (not_started, in_progress, paused, completed, skipped, abandoned) odvojen od ishoda (verified_success, self_reported_success, partial, failed, not_assessed). Preskočeno = not_assessed, nikad failed.
- Ponovni ulazak u scenario otvara novi pokušaj; istorija se ne briše.
- Aktivno vreme = zbir aktivnih intervala; auto-pauza posle 60 s bez interakcije ili kad je tab sakriven; vreme u uputstvu se beleži odvojeno (help_duration) i ne ulazi u aktivno vreme.
- Stanje preživljava refresh, više tabova i odjavu (E11 se čuva pre odjave).
- Verifikovan uspeh iz stvarnih operacija u bazi: E3 (prijava podneta tokom pokušaja), E6A/E6B (kredencijal prihvaćen/odbijen tokom pokušaja), E7B (javna vidljivost isključena pa vraćena). Ostali scenariji: samoprijava ili zabeležena navigacija.
- Događaji samo iz zatvorene liste i sa dozvoljenim ključevima metapodataka; idempotentni (klijentski ID događaja).

## Tehnički detalji
- Nove tabele: evaluation_campaigns, evaluation_assignments, evaluation_sessions, evaluation_scenarios (seed E1–E11, rola earner, spremno za issuer_staff/issuer_admin), evaluation_attempts, evaluation_events (unique client_event_id), evaluation_consent_audit. RLS: korisnik čita/piše samo svoje; platform_admin čita sve; samo platform_admin upravlja kampanjama/dodelama.
- Verifikovani ishodi: triggeri AFTER INSERT na applications i AFTER UPDATE na credentials (accepted_at/rejected_at, share_is_public) koji, samo ako postoji aktivan pokušaj odgovarajućeg scenarija za tog korisnika, upisuju događaj i outcome. Triggeri su SECURITY DEFINER, u try/except bloku — greška u evaluaciji nikad ne blokira osnovnu operaciju.
- Server funkcije: `src/lib/evaluation.functions.ts` (earner: stanje, pristanak, start/pause/resume/skip/complete, help, events) i `src/lib/evaluation-admin.functions.ts` (provera platform_admin, kampanje, dodele, rezultati, CSV).
- Klijent: `EvaluationProvider` u AppSidebarLayout (samo za earnere sa dodelom), modal, drawer, sticky panel, tajmer (performance.now + serverski timestampovi), hook `useEvalEvent` za semantičke događaje na earner stranicama (dashboard, katalog, detalji šablona, prijave, kredencijali, obaveštenja, podešavanja, javni profil, odjava).
- Ruta `admin.evaluation.tsx` + stavka u admin meniju; svi tekstovi EN/SR.
- Testovi (Vitest): skipped → not_assessed; pauza isključena iz aktivnog vremena; novi pokušaj ne briše stari; CSV bez direktnih identifikatora.

## Otvoreno / potrebno od vas
- Pun tekst scenarija E1–E11 (situacija, koraci, očekivanja) iz PDF-a „Sticanje Mikrokredencijala scenario“ nije priložen — do tada ubacujem kratke opise iz specifikacije, a tekst je lako zameniti.
- Testni resursi za E3/E6 (testni šablon, 1–2 ponuđena kredencijala po učesniku) pripremaju se kroz postojeće issuer tokove pre pilota.
- E8 povezivanje javne verifikacije sa pokušajem preko anonimnog tokena ostaje za Fazu B; u v1 se beleži kreiranje/kopiranje linka i samoprijava.
- Link ka USE upitniku i tekst o privatnosti (verzija politike) — dostaviti, do tada privremeni tekst.
