## Problem

Neki redovi u Blockchain Anchoring Queue prikazuju Retry (i Repair) dugmiće iako je kredencijal/template već uspešno usidren (Blockchain = Confirmed). Razlog: kada `repairCredentialChainFields` ili `processCredentialAnchor` uspešno objave anchor, ažuriraju se `credentials` (`chain_status = confirmed`) i `credential_blockchain_records`, ali se **odgovarajući red u `credential_anchor_jobs` ne ažurira** — ostaje `status = queued/failed`, `attempts = 0`. UI dugmiće računa po `job.status`, pa nudi Retry nad već usidrenim kredencijalom. Ista stvar važi i za template-e (`processTemplateAnchor` ne dira `template_anchor_jobs`).

## Plan

1. **`src/lib/chain/worker.server.ts` — `processCredentialAnchor`**
   - Nakon `submitCredentialAnchor`: pored update-a `credentials` i `credential_blockchain_records`, ažurirati pripadajući red u `credential_anchor_jobs` (operation `anchor_credential`) na `status = "done"`, `attempts = attempts + 1`, `last_attempt_at = now`, `last_error = null`, `transaction_hash = res.txHash`.
   - U `catch` grani: ažurirati taj isti job na `status = "failed"`, `attempts = attempts + 1`, `last_attempt_at = now`, `last_error = msg`.

2. **`src/lib/chain/worker.server.ts` — `processTemplateAnchor`**
   - Ista logika: nakon uspeha postaviti `template_anchor_jobs.status = "done"` (+ tx hash, attempts, last_attempt_at, clear last_error); na grešku `failed` + last_error.

3. **`src/lib/chain/anchor.functions.ts` — `repairCredentialChainFields`**
   - Posle inline poziva `processCredentialAnchor`, ako je `res.ok`, eksplicitno setovati `credential_anchor_jobs.status = "done"` za taj `credential_id` (sigurnosna mreža, čak i ako neko jednog dana refaktoriše worker).

4. **Backfill jednokratnom migracijom (SQL)**
   - Postaviti `credential_anchor_jobs.status = 'done'` za sve job-ove čiji je odgovarajući `credentials.chain_status = 'confirmed'` i job nije već `done/cancelled`.
   - Isto za `template_anchor_jobs` u odnosu na `templates.blockchain_status = 'confirmed'`.
   - Time se postojeći "zalutali" redovi (kao "A Little Help from My Friends — Marko Pepić") odmah čiste.

5. **`src/routes/issuer.anchoring-queue.tsx` — UI sigurnosna mreža**
   - Sakriti dugmiće Retry, Repair i Cancel kada je `bcStatus === "confirmed"`, bez obzira na `job.status`. Ostaviti samo "View transaction" link.
   - Ovo sprečava akcije čak i ako se ikada desi neusklađenost između `job` reda i pravog chain stanja.

## Ishod

- Posle uspešnog `repair`-a ili `retry`-a, red u queue-u prelazi u `done` i nema više dugmadi za dodatne blockchain akcije.
- Postojeći neusklađeni redovi se popravljaju kroz backfill migraciju.
- UI guard sprečava buduće "ghost" akcije nad već potvrđenim ankerima.
