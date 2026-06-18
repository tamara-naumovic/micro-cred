Na stranici Revocations trenutno postoji jedno search polje koje filtrira i po imenu earner-a i po naslovu MK template-a (title). Potrebno je razdvojiti ovo u dva nezavisna filtera:

1. **Search polje** — pretraga samo po `earnerName` (case-insensitive substring). Placeholder promijeniti na odgovarajući tekst (npr. "Search earner…").

2. **MK template dropdown** — Select komponenta koja nudi jedinstvene MK template naslove (`title`) prisutne u tabeli. Filtriran 1:1 po odabranom template-u. Opcija "All templates" (ili prazno) za prikaz svih.

Ovo se primjenjuje na **obje tabele** (Revocation history i Revoke a credential), sa nezavisnim state-om po tabeli — dakle:
- `historyEarnerQ` + `historyTemplateFilter`  
- `activeEarnerQ` + `activeTemplateFilter`

Paginacija i sve ostalo ostaje nepromijenjeno.