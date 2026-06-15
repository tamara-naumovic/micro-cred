## Goal
Dozvoliti issuer admin/staff korisnicima da bulk issuance popune ili (a) lepljenjem CSV-a u postojeće textarea polje, ili (b) uploadom `.csv` fajla — fajl se učitava klijentski i puni isto `csv` state-promenljivu, tako da ostatak pipeline-a (parseCsv → resolved → submit) ostaje netaknut.

## Izmene — `src/routes/issuer.issue.bulk.tsx`

1. Dodati `useRef<HTMLInputElement>(null)` za hidden file input i `fileName` state za prikaz imena učitanog fajla.
2. Renderovati iznad `Textarea` mali toolbar sa:
   - `<Button variant="outline" size="sm" type="button">` "Upload CSV" koji okida `fileInputRef.current?.click()`
   - `<input type="file" accept=".csv,text/csv" hidden />` čiji `onChange`:
     - čita prvi fajl preko `file.text()` (UTF-8 default; strip-uje UTF-8 BOM `\uFEFF` ako je prisutan)
     - validira ekstenziju/MIME i veličinu (max 1 MB) — toast.error inače
     - poziva `setCsv(text)` i `setFileName(file.name)`
     - resetuje `e.target.value = ""` da isti fajl može ponovo da se uploaduje
   - kad `fileName` postoji: mali muted tekst "Učitano: <ime> · Clear" gde "Clear" vraća `SAMPLE` i prazni `fileName`.
3. Helper tekst ispod textarea proširiti: "Headers: email, grade, expiryDate. Možete prilepiti CSV ili uploadovati .csv fajl (UTF-8)."
4. `PageShell` description ažurirati — ukloniti "(or upload via XLSX in the production version)" pošto sad realno podržavamo CSV upload.

## Van scope-a
- Nema XLSX podrške (samo CSV, kako je traženo).
- Nema promena na serverFn `issueCredentialsBatch` niti na `parseCsv` — fajl prolazi isti put kao paste.
- Nema backend ni permission izmena.
