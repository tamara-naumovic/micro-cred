# Evaluation modul v2 — analiza i redosled dorade

## 1. Rezultat analize (stvarno stanje)

**Šta već postoji i radi**
- Aktivacija po nalogu, pristanak (prihvati / kasnije / odbij / završi), sesije, pokušaji sa brojem pokušaja, preskakanje i ponovni pokušaj bez brisanja istorije.
- Tri odvojena polja na pokušaju: status, ishod, izvor ishoda. Preskakanje nikad ne daje neuspeh.
- Serverska provera već postoji za: E3 (nova prijava), E6A (prihvatanje), E6B (odbijanje), E7A (promena vidljivosti, samo zabeleženo, bez uspeha), E7B (sakrij pa vrati). E11 se potvrđuje u aplikaciji pri odjavi.
- Pomoć: otvaranje uputstva pauzira tajmer; vreme pomoći se vodi odvojeno i nije u aktivnom vremenu. Tri događaja (uputstvo / zahtev nastavniku / dobijena pomoć) se već beleže odvojeno.
- Pseudonim učesnika (P-XXXXXXXX) postoji i ide u izvoz; USE link se prikazuje na kraju.
- Excel izvoz ima zbirni list i list po učesniku.

**Pronađeni problemi (potvrđeni u podacima)**
1. **Potvrđeni uspeh se briše.** E6A: server je zabeležio prihvatanje ponude i upisao „verified_success", ali je klik na „Završi scenario" nekoliko sekundi kasnije prepisao ishod u „not_assessed" (aplikacija je koristila stari prikaz). Zato u izvozu stoji „not_assessed / server". Isti obrazac pogađa E3, E6B, E7B.
2. **E3 u kampanji „Tamara test"**: u tom pokušaju nema zabeležene nove prijave, pa „not_assessed" je tačan — korisnik nije podneo prijavu tokom pokušaja.
3. **Ishod može da upiše i sam korisnik** (pravo izmene pokušaja nije ograničeno po poljima) — u teoriji može „fabrikovati" uspeh.
4. **Tajmer**: automatski pauzira posle 60 s bez klika (spec. kaže da to nije dokaz neaktivnosti); osvežavanje / zatvaranje pretraživača ostavlja pokušaj „u toku", pa se vreme dok je pretraživač zatvoren računa kao aktivno. Vreme pomoći se gubi ako se stranica osveži dok je uputstvo otvoreno. Nema ukupnog vremena ni oznake kvaliteta merenja.
5. **Pomoć nastavnika**: brzo višestruko klikanje beleži duplikate (u jednom E3 pokušaju 6 „dobijenih" pomoći za 5 sekundi).
6. **Broj grešaka** se nigde ne povećava — u izvozu je uvek 0 (treba prikazati kao „nije mereno").
7. **USE**: pseudonim se ne prikazuje učesniku, nema „Kopiraj ID".
8. **Dashboard**: nedostaju Not assessed, stope sa imeniteljem, N uz medijanu; medijana i dalje računa sve završene pokušaje bez jasne napomene.

## 2. Predloženi redosled (iterativno)

**Korak 1 — P0 ispravke ishoda (najvažnije)**
- Klik na „Završi" nikad ne može da sruši serverski potvrđen uspeh; ishod se ponovo pročita iz baze pre upisa.
- Zaštita u bazi: korisnik može da postavi samo „self_reported_success" / „not_assessed"; „verified_success" i izvor „server" upisuje samo server.
- Server proveru vezati isključivo za aktivni pokušaj tog učesnika u aktivnoj kampanji (već je tako — dodajem test). Uspeh se upisuje jednom.
- E11 prebaciti na serversku potvrdu (događaj pre gašenja sesije), E7A ostaje „partial" uz jasnu oznaku.
- Za svaki scenario u izvozu: pravilo provere ili razlog „not_assessed" (npr. „nema automatske provere", „korisnik nije potvrdio").

**Korak 2 — P0 tajmer i pomoć**
- Ukloniti automatsku pauzu zbog 60 s bez klika; pauza ostaje samo za eksplicitnu pauzu, skriven tab i pomoć.
- Posle osvežavanja / ponovnog dolaska: interval tokom kog je stranica bila zatvorena se ne računa, a pokušaj dobija oznaku „uncertain".
- Vreme pomoći čuvati u bazi (početak otvaranja), da preživi osvežavanje.
- Dodati ukupno vreme (od početka do kraja) i verziju definicije tajmera.
- Sprečiti duple klikove na dugmad pomoći nastavnika (kratka blokada + uklanjanje duplikata u izveštaju). „Dobijena" pomoć može postojati i bez zahteva — to ostaje dozvoljeno.

**Korak 3 — P0 USE povezivanje**
- Na kraju testiranja prikazati „Vaš ID učesnika: P-XXXXXXXX" i dugme „Kopiraj ID", uz kratko objašnjenje da ga upiše u upitnik. Otvaranje upitnika nije uslov za završetak.
- Prepopunjavanje linka za Microsoft Forms ne uvodim sada (nije provereno da li ga vaš upitnik podržava).

**Korak 4 — P1 dashboard + izvoz (iste formule na oba mesta)**
- Kolone: Verified success rate, Self-reported, Not assessed, Skipped, Abandoned, Help rate, Instructor assistance rate, Error count („nije mereno"), Medijana aktivnog vremena + N.
- Tooltip sa formulom i imeniteljem za svaku stopu.
- Izvoz dobija nova polja (ukupno vreme, kvalitet tajmera, verzija definicije, broj zahteva/dobijenih pomoći, pravilo provere / razlog) i list sa događajima (bez ličnih podataka). Prazno umesto nule kada nešto nije mereno.

**Kasnije (P1/P2, ne sada osim ako želite)**: provere razumevanja (E1, E2, E4, E5, E9, E10), oznaka „nedostaje preduslov" pre početka scenarija, dodatne vizuelizacije.

## 3. Šta se ne menja
Izdavanje, blockchain, prijava i ovlašćenja ostaju netaknuti; evaluacioni okidači ostaju „bezbedni" (nikad ne blokiraju glavnu radnju). Postojeći podaci ostaju; novi stubci su dodatni. Samo Earner scenariji.

## Tehnički detalji
- Tabele: `evaluation_attempts` + nove kolone `elapsed_ms`, `timer_quality`, `timer_definition_version`, `help_started_at`, `verification_rule`, `not_assessed_reason`; BEFORE UPDATE okidač koji za ne-servis ulogu zadržava `outcome`/`outcome_source` kada je već `verified_success` i odbija klijentski `verified_success`. Nova RPC `eval_record_logout()` za E11.
- `EvaluationProvider.tsx`: `complete/skip` čitaju svež red; uklonjen idle interval; `beforeunload`/`pagehide` zamrzava interval; `help_started_at` u bazi; debounce za instructor dugmad.
- `logic.ts` + testovi: `outcomeOnComplete` sa svežim ishodom, nove funkcije za stope (zajedničke za dashboard i `workbook.ts`), deduplikacija događaja.
- `EvaluationUI.tsx`: blok sa ID-jem i kopiranjem; `admin.evaluation.tsx` i `workbook.ts`: nove kolone i list događaja; EN/SR prevodi.
- Testovi prihvatanja iz sekcije 10 specifikacije kao Vitest testovi za pravila + ručni prolaz E1, E3, E5, E6, E7, E11.
