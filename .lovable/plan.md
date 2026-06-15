## Plan: Vratiti EXECUTE na helper RLS funkcije

### Problem

Svi `SELECT`/queriji vraćaju `42501 permission denied for function is_platform_admin`. Razlog: helper SECURITY DEFINER funkcije koje koriste RLS policy-ji nemaju `EXECUTE` granted za `authenticated` (ni `anon`) — verovatno usled ranijeg lint "fix"-a koji je revoked EXECUTE. Login se desi (`/token` 200), ali bridge `profiles`/`user_roles` queriji 403-uju, `activeUser` ostaje `null`, login stranica zaglavi na "Sign in" spinner-u.

### Migracija

`GRANT EXECUTE` na sledeće helper funkcije za `authenticated` (i `anon` gde im je potrebno za public flow-e — npr. RLS policy-ji na `templates`/`organizations` koje anon čita):

- `public.is_platform_admin(uuid)`
- `public.has_role(uuid, app_role)`
- `public.has_role_in_org(uuid, app_role, uuid)`
- `public.is_org_member(uuid, uuid)`
- `public.is_template_assignee(uuid, uuid)`
- `public.template_issuer_org(uuid)`
- `public.can_access_application(uuid)`

Trigger funkcije (`notify_on_*`, `handle_new_user`, `sync_credential_status_from_lifecycle`, `set_updated_at`) NE diramo — pozivaju se isključivo iz triggera, ne preko Data API-ja.

### Security memory

Dodati napomenu: te helper funkcije MORAJU imati EXECUTE za `authenticated`/`anon`, inače RLS pada — ne tretirati ih kao kandidate za 0029/0028 lint remediation. Ostaju SECURITY DEFINER (čitaju `user_roles` bez davanja širokog SELECT-a), to je namera.

### Verifikacija

Nakon migracije: ponoviti login u preview-u i potvrditi da se navigira na `/issuer` (Tamara je `issuer_admin`).