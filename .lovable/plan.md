## Cilj

Tabela na `/issuer/credentials` treba da se automatski osveži nakon akcija (Edit & resend, Accept rejection, Renew expiry) bez ručnog refresh-a stranice.

## Uzrok trenutnog ponašanja

- `confirmResend` i `confirmDiscard` pozivaju server fn ali **nikad ne pozivaju `refresh()`** iz `useStore()`. Tabela čita iz `credentials` u store-u koji ostaje stale dok korisnik ne reload-uje stranicu.
- `advanceRenewal` već poziva `await refresh()` — dakle pattern već postoji.

## Izmena

U `src/routes/issuer.credentials.tsx`:

1. Dodati `await refresh()` u `confirmResend` (nakon uspešnog `resend(...)`, pre `setEditTarget(null)`).
2. Dodati `await refresh()` u `confirmDiscard` (nakon uspešnog `discard(...)`, pre `setDiscardTarget(null)`).
3. `advanceRenewal` već ima refresh — bez izmene.

Sve tri akcije će po uspehu povući svežu listu kredencijala iz store-a, pa će se badge-ovi statusa, kolona Expires i red sam (kod brisanja) odmah ažurirati.

## Fajlovi

- `src/routes/issuer.credentials.tsx`
