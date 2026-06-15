# "Credentials issued over time" — popravka grafika

## Šta grafik treba da prikazuje

Linijski grafik sa dve serije po vremenskim "bucket"-ima:
- **Issued** — broj kredencijala koje je tvoja institucija izdala u tom periodu (po datumu `issued_at`).
- **Confirmed** — koliko od njih je do sada potvrđeno na Bloxberg blockchain-u.

Granularnost bucket-a zavisi od izabranog perioda (gornji-desni Select):
- `Last 30 days` → po danu
- `Last 6 months` → po nedelji
- `This academic year` / `All time` → po mesecu

## Problemi koje vidiš

1. **Grafik izgleda prazno** — bucket-i su uvek pre-seedovani na 0, pa kad nemaš izdate kredencijale u tom periodu, obe linije sede na y=0 (vizuelno se gube uz X-osu, a poruka "No credentials…" se nikad ne prikaže jer uslov `series.length === 0` nije ispunjen).
2. **Nejasne oznake na X-osi** — za period "Last 6 months" se generiše `W2 Jun`, `W4 Jun` (broj nedelje u mesecu 1–5). To je nestandardno i ume da se ponovi kroz mesece.

## Izmene

### 1. Empty state radi i kad su sve vrednosti 0
U `issuer.index.tsx` (oko linije 420), zameniti uslov:
```
series.length === 0
```
sa:
```
series.every((p) => p.issued === 0 && p.confirmed === 0)
```
Tako će se uredna poruka "No credentials have been issued in this period." prikazati kad nema podataka, umesto prazne mreže.

### 2. Čitljive oznake na X-osi
U `buildTimeSeries` (`fmt` funkcija, oko linije 587):
- **day** (30d): zadržati `Jun 14`.
- **week** (6m): umesto `W2 Jun`, koristiti datum početka nedelje u formatu `Jun 8` (kratko, hronološki rastuće, bez ponavljanja "W1/W2" po mesecima). Tooltip može da pokazuje pun raspon (`Jun 8 – Jun 14`).
- **month** (ay/all): umesto `Jun 25` (2-digit godina deluje kao dan), koristiti `Jun 2026` (pun mesec + 4-cifrena godina).

### 3. Pojašnjenje naslova i opisa kartice
- Naslov ostaje `Credentials issued over time`.
- Opis menjamo iz `Internally issued vs confirmed on Bloxberg` u nešto eksplicitnije, npr.:
  `Number of credentials issued per {day|week|month} and how many are confirmed on Bloxberg.` (granularnost se popunjava dinamički na osnovu izabranog perioda).

### 4. Tooltip sa rasponom bucket-a (za nedelje i mesece)
Dodati `rangeLabel` polje u svaku tačku serije (npr. `Jun 8 – Jun 14` za nedelju, `June 2026` za mesec) i prikazati ga kao naslov tooltip-a preko `labelFormatter` u Recharts `Tooltip`-u. Time se uklanja svaka dvosmislenost oko toga šta `Jun 8` zapravo pokriva.

## Šta NEĆE biti menjano

- Logika autorizacije, dovlačenje podataka, ni RLS.
- Filter po template-u i selektor perioda — ostaju.
- Druge kartice na dashboard-u.
