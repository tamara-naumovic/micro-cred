## Cilj

Generisati jedan Markdown dokument koji opisuje kompletan data model platforme, sa ugrađenim Mermaid ER dijagramom. Fajl će biti dostupan za preuzimanje iz `/mnt/documents/`.

## Šta dokument sadrži

1. **Pregled** — kratak opis domena (organizacije, korisnici/uloge, šabloni mikrokredencijala, prijave, izdati kredencijali, blockchain anchoring, notifikacije, audit).
2. **Enumi** — sve PostgreSQL enum tipove (`app_role`, `credential_status`, `learning_source`, `cred_level`, lifecycle/anchor statusi, itd.) sa dozvoljenim vrednostima.
3. **Tabele** — za svaku tabelu u `public` šemi:
   - Ime, kratak opis namene
   - Tabela kolona: ime, tip, nullable, default, opis
   - Primarni i strani ključevi
   - Indeksi (gde su značajni)
   - RLS politike (ko može da čita/menja, na šta su skupljene)
4. **Database funkcije i trigeri** — `has_role`, `has_role_in_org`, `is_platform_admin`, `is_template_assignee`, `handle_new_user`, `get_public_*`, notify trigeri, sync trigeri.
5. **Storage bucket-i** — `qa-documents`, `accreditation-docs` (privatnost + ko ima pristup).
6. **Mermaid ER dijagram** — vizuelni prikaz svih tabela i veza (FK), grupisan po domenima (Identitet, Organizacija, Kredencijali, Blockchain, Notifikacije/Audit).
7. **Tok podataka** — kratak narativ: registracija → prijava → izdavanje → prihvatanje → anchoring → verifikacija/deljenje.

## Kako će se generisati

- Pročitati šemu iz baze (`information_schema`, `pg_policies`, `pg_constraint`, enum vrednosti) preko read-only upita.
- Pročitati FK veze za Mermaid dijagram.
- Sastaviti `.md` fajl u `/mnt/documents/data-model.md`.
- Isporučiti link za preuzimanje (`<presentation-artifact>`).

## Ishod

Jedan `data-model.md` fajl koji možeš otvoriti u bilo kom Markdown čitaču (GitHub, VS Code, Obsidian…), sa ER dijagramom koji se renderuje automatski.
