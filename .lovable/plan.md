## Plan: Ignorisati SECURITY DEFINER warning za 3 javne funkcije

Linter prijavljuje 6 nalaza (3 × 0028 anon + 3 × 0029 authenticated). Sve potiču od istih funkcija koje su **namerno** javne:

| Funkcija | Svrha |
|---|---|
| `get_public_profile(_share_token)` | Public profil earnera (share link) |
| `get_public_credential(_share_token)` | Public verifikacija credentiala |
| `get_credential_visibility(_share_token)` | Provera da li je share link aktivan |

One MORAJU biti `SECURITY DEFINER` da bi anon/authenticated korisnici mogli pristupiti samo redovima sa važećim tokenom — bez davanja širokog SELECT-a na tabele. To je standardni pattern za public share linkove.

### Koraci

1. Ignorisati nalaze `SUPA_authenticated_security_definer_function_executable` i `SUPA_anon_security_definer_function_executable` sa objašnjenjem koje pokriva sve tri funkcije.
2. Ažurirati security memory tako da budući skenovi ne flag-uju isti pattern.

Bez izmena u kodu/bazi.