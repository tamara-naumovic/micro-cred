
## Promene

### 1. Issuer Dashboard (`src/routes/issuer.index.tsx`)
- Zameniti karticu **"Revoked"** sa **"Active requests"** — broj aplikacija od `myApps` čiji status nije `issued` ni `rejected`. Ikonu promeniti u `Inbox`/`Send` ton `warning` ili `primary`.
- Preimenovati karticu **"Active templates"** u **"Active Micro-credentials"** (vrednost ostaje isti broj).

### 2. Human-readable statusi u Earner aplikacijama
Problem: `StatusBadge` (`src/components/StatusBadge.tsx`) nema labele za sve `RequestStatus` vrednosti — `in_review`, `evidence_collected`, `verified_by_provider` fallback-uju na sirovi enum (kao na screenshotu: `evidence_collected`).

Dodati u `LABELS` i `TONE` mape:
- `in_review` → "In review"
- `evidence_collected` → "Evidence collected"
- `verified_by_provider` → "Verified by provider"
- `submitted` već postoji ("Submitted")

Tonovi: `info` za in_review / evidence_collected, `success` light za verified_by_provider.

### 3. Sprečiti duplo apliciranje (`src/routes/earner.apply.tsx`)
Earner ne sme da podnese zahtev za template za koji već ima:
- aktivnu aplikaciju (status ≠ `issued` i ≠ `rejected`), ili
- izdat credential (`credentials` sadrži `templateId` za tog earner-a sa status `active`).

Implementacija:
- Pročitati `applications` i `credentials` iz `useStore()`.
- Izračunati `blockedTemplateIds` set za trenutnog `activeUser`.
- U koraku 1 prikazati sve aktivne templates, ali blokirane onemogućiti (disabled card, faded, badge "Already applied" ili "Already issued") i sprečiti `setTemplateId`.
- U `submit()` defensive check: ako je blocked, prikazati `toast.error` i prekinuti.

## Fajlovi
- `src/routes/issuer.index.tsx`
- `src/components/StatusBadge.tsx`
- `src/routes/earner.apply.tsx`
