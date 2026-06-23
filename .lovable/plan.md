## Plan: Razdvojen prikaz formalnih/neformalnih MK + filteri

Izmena u `src/routes/issuer.microcredential-templates.index.tsx`:

### 1. Tabovi (formalni / neformalni)
- Koristiti shadcn `Tabs` komponentu sa dva taba: "Formalni" i "Neformalni".
- Lista šablona se deli po `tmpl.source === "formal"` vs `"non_formal"`.
- Broj šablona prikazan u oznaci taba (npr. `Formalni (5)`).

### 2. Filteri (zajednički, primenjuju se na oba prikaza)
Iznad tabova, red sa tri kontrole:
- **Pretraga po naslovu** — `Input` sa ikonicom, filtrira po `tmpl.title` (case-insensitive substring).
- **Filter po nivou** — `Select` sa opcijama: Svi, Foundation, Intermediate, Advanced, Expert, N/A. Filtrira po `tmpl.level`.
- **Filter po dodeljenom zaposlenom** — `Select` sa opcijama: Svi + lista staff korisnika organizacije (iz `users` + `templateAssignees`). Filtrira šablone u kojima izabrani staff ima dodelu (`templateAssignees.some(a => a.templateId === tmpl.id && a.userId === selectedStaffId)`).
- Filter po staff-u se prikazuje samo za `issuer_admin` (staff korisnik već vidi samo svoje).
- Dugme "Resetuj filtere" kada je bilo koji filter aktivan.

### 3. Prazno stanje
- Ako filteri sakriju sve rezultate: poruka "Nema šablona koji odgovaraju filterima".
- Ako organizacija nema nijedan šablon u toj kategoriji: postojeća empty poruka.

### 4. Prevodi
Dodati ključeve u `src/i18n/locales/{en,sr}/issuer/templates.json` pod `index.filters`:
- `tabFormal`, `tabNonFormal`
- `searchPlaceholder`, `levelLabel`, `levelAll`, `staffLabel`, `staffAll`
- `resetButton`, `emptyFiltered`

### Tehnički detalji
- State: `useState` za `search`, `levelFilter`, `staffFilter`, `activeTab`.
- `useMemo` za filtriranu listu da izbegne re-render.
- Lista staff korisnika: `users.filter(u => u.organizationId === activeUser.organizationId && u.subRole === "staff")` iz `useStore()`.
- Postojeća grid kartica i akcije ostaju nepromenjene.

Bez izmena na backend/store sloju.