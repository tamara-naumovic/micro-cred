## Plan: Authorize `/api/public/hooks/expiry-reminders`

Endpoint trenutno koristi service-role klijenta bez ikakve provere. Dodajemo shared secret.

### Koraci

1. **Tražim od korisnika novi secret `CRON_SECRET`** (preko `secrets--add_secret`) — server-side env var.
2. **Update `src/routes/api/public/hooks/expiry-reminders.ts`**:
   - Pre bilo kakvog rada, pročitati `Authorization: Bearer <token>` header (ili `x-cron-secret`).
   - Uporediti sa `process.env.CRON_SECRET` koristeći `timingSafeEqual`.
   - Ako se ne poklapa ili nedostaje → vratiti `401`.
3. **Update pg_cron job-a** (ako postoji) — proslediti `Authorization: Bearer <CRON_SECRET>` header. Ako cron još nije zakazan, pripremiti SQL snippet koji korisnik može pokrenuti.
4. Mark security finding `expiry_reminders_no_auth` kao fixed.

### Napomena

Service-role ključ se i dalje koristi unutar handlera (potrebno za masovni read/insert preko earnera), ali sada samo autentifikovani cron poziv može doći do te logike.