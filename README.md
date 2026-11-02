# Money Home

Domowy budżet dla dwojga, zbudowany na bazie arkusza „DOMOWY BUDŻET”: dochody, opłaty stałe, wydatki,
nadpłaty i kredyt hipoteczny, wspólne dla dwóch telefonów (Android + iPhone).

> **Status:** prototyp do akceptacji. Logika, obliczenia i wszystkie ekrany działają; synchronizacja
> między telefonami jest na razie symulowana.

## Co jest w środku

| Ekran | Co robi |
|---|---|
| **Start** | Bilans miesiąca (ile zostaje), na co idzie dochód, rok w liczbach, wykres 12 miesięcy. Przełącznik: Razem / osoba 1 / osoba 2 / Porównaj. |
| **Wpisy** | Lista miesiąca z edycją i usuwaniem (z „Cofnij”), filtry, „opłaty jak w poprzednim miesiącu” jednym ruchem. Widok **Arkusz**: cały rok w układzie jak w Excelu. |
| **+** | Dochód, opłata, wydatek (także na raty) albo nadpłata. Podpowiada kwotę „jak ostatnio”, rozumie „1200 + 349,90”. |
| **Kredyt** | Ile mieszkania jest już Wasze, saldo, efekt dotychczasowych nadpłat, **symulator nadpłat** (o ile szybciej, ile mniej odsetek), wkład każdej osoby. |
| **Więcej** | Wspólne dane i łączenie drugiego telefonu (QR / kod), domownicy, kategorie opłat, motyw jasny/ciemny. |

Obliczenia odtwarzają arkusz: opłaty stałe dzielone po połowie, nadpłata liczona osobie, która ją zrobiła,
„Reszta” osoby = dochód − ½ opłat − własne nadpłaty; dla domu = dochód − opłaty − nadpłaty − wydatki.
Testy porównują każdy miesiąc z wynikami policzonymi przez sam arkusz.

## Prywatność danych

W kodzie **nie ma żadnych danych budżetu**, więc repozytorium może być nawet publiczne. Dane z arkusza
konwertuje się lokalnie i podaje przy budowaniu (`SEED_FILE`), a docelowo trzymane są w **prywatnym**
miejscu (jeden plik JSON), do którego aplikacja ma dostęp tokenem zapisanym tylko w telefonach.

## Rozwój

```bash
npm install
npm run dev                 # podgląd w przeglądarce
npm test                    # testy (bez danych)
npm run typecheck

# dane z arkusza (lokalnie, poza repo)
python3 -I tools/xlsx_to_json.py ~/budget.xlsx ~/budget.json
SEED_FILE=~/budget.json npm test             # + testy zgodności z arkuszem
SEED_FILE=~/budget.json npm run build:prototype   # jeden plik HTML: dist/prototype.html
```

Stos: Preact + TypeScript + Vite, bez zależności w runtime poza `qrcode-generator`. Czcionki (Albert Sans,
Shippori Mincho) są dołączone do paczki, więc aplikacja działa offline.

## Plan (po akceptacji prototypu)

1. Synchronizacja: plik `budzet.json` w prywatnym repo GitHub, zapis offline-first, scalanie zmian wpis po wpisie,
   historia zmian w commitach.
2. Android: APK (Capacitor) budowany przez GitHub Actions i publikowany w Releases.
3. iPhone: ta sama aplikacja jako PWA (Safari → Do ekranu początkowego), z działaniem offline.
4. Eksport/import Excela w układzie arkusza.
