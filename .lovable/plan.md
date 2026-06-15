Export svih korisnika platforme u CSV (bez lozinki — nedostupne by design).

## Kolone
`name`, `email`, `roles`, `organizations`, `country`, `created_at`

## Izvor
- `public.profiles` (name, email, country, created_at)
- `public.user_roles` agregirano po korisniku (`string_agg`)
- `public.organizations` joined preko `user_roles.organization_id`

## Output
`/mnt/documents/platform_users.csv` — predstavljen kao downloadable artifact.

Prebaci u build mode da pokrenem export.