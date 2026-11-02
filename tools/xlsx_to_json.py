#!/usr/bin/env python3
"""Convert the 'DOMOWY BUDŻET' spreadsheet template into Money Home JSON.

Usage:  python3 -I tools/xlsx_to_json.py budget.xlsx out.json

The layout is located by its labels (DOCHÓD / OPŁATY / WYDATKI / KREDYT), so
moving blocks a few rows up or down is fine. Amounts are stored in grosze.
"""
import json
import re
import sys
from datetime import datetime, timezone

import openpyxl

MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec",
          "sierpień", "wrzesień", "październik", "listopad", "grudzień"]
INCOME_CATS = {"podstawa": "base", "nadgodziny": "overtime", "premia": "bonus"}
BILL_CATS = {
    "kredyt": ("mortgage", "Rata kredytu"),
    "ubezpieczenie": ("insurance", "Ubezpieczenie"),
    "pge": ("power", "Prąd (PGE)"),
    "internet netia": ("internet", "Internet (Netia)"),
    "internet": ("internet", "Internet"),
    "czynsz": ("rent", "Czynsz"),
}


def norm(v):
    return str(v).strip().lower() if v is not None else ""


def slug(s):
    s = norm(s)
    for a, b in zip("ąćęłńóśźż", "acelnoszz"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def grosze(x):
    return int(round(float(x) * 100))


def main(src, dst):
    wb_f = openpyxl.load_workbook(src, data_only=False)
    wb_v = openpyxl.load_workbook(src, data_only=True)
    ws, wv = wb_f.worksheets[0], wb_v.worksheets[0]

    # ---- locate blocks -------------------------------------------------
    title_rows = {}
    for row in ws.iter_rows():
        for c in row:
            t = norm(c.value)
            # block titles are written in capitals (row labels like "Wydatki" are not)
            if t in ("dochód", "opłaty", "wydatki", "kredyt", "dochód vs opłaty") and c.column <= 4 \
                    and str(c.value).strip().isupper():
                title_rows.setdefault(t, c.row)
    year = None
    for row in ws.iter_rows(min_row=1, max_row=6):
        for c in row:
            if isinstance(c.value, (int, float)) and 2000 < c.value < 2100:
                year = int(c.value)
                break
        if year:
            break
    year = year or datetime.now().year

    # month columns from the first header row that lists all months
    month_cols = {}
    for row in ws.iter_rows(min_row=1, max_row=10):
        found = {norm(c.value): c.column for c in row if norm(c.value) in MONTHS}
        if len(found) == 12:
            month_cols = {MONTHS.index(k) + 1: col for k, col in found.items()}
            break
    if not month_cols:
        sys.exit("Nie znaleziono nagłówka z miesiącami")

    def mkey(m):
        return f"{year}-{m:02d}"

    entries = []
    people = []
    now = int(datetime.now(timezone.utc).timestamp() * 1000)

    def add(e):
        e.update(createdAt=now, createdBy="import", updatedAt=now, updatedBy="import")
        entries.append(e)

    # ---- income ---------------------------------------------------------
    r0, r1 = title_rows["dochód"], title_rows["opłaty"]
    person = None
    for r in range(r0 + 1, r1):
        cname, cat = ws.cell(r, 3).value, norm(ws.cell(r, 4).value)
        if cname and norm(cname) not in ("razem",) and not isinstance(cname, (int, float)):
            person = slug(cname)
            if person not in [p["id"] for p in people]:
                people.append({"id": person, "name": str(cname).strip()})
        if norm(cname) == "razem":
            person = None
        if person and cat in INCOME_CATS:
            for m, col in month_cols.items():
                v = wv.cell(r, col).value
                if isinstance(v, (int, float)) and v != 0:
                    add({"id": f"imp-{mkey(m)}-inc-{person}-{INCOME_CATS[cat]}", "type": "income",
                         "month": mkey(m), "amount": grosze(v), "person": person,
                         "category": INCOME_CATS[cat]})

    # ---- overpayments & bills ------------------------------------------
    r2 = title_rows.get("dochód vs opłaty", r1 + 20)
    bill_categories = []
    person = None
    for r in range(r1, r2):
        cname, label = ws.cell(r, 3).value, norm(ws.cell(r, 4).value)
        if cname and not isinstance(cname, (int, float)):
            person = None if norm(cname) == "razem" else slug(cname)
        if label == "nadpłata" and person:
            for m, col in month_cols.items():
                v = wv.cell(r, col).value
                if isinstance(v, (int, float)) and v != 0:
                    add({"id": f"imp-{mkey(m)}-ovp-{person}", "type": "overpayment", "month": mkey(m),
                         "amount": grosze(v), "person": person})
        elif label in BILL_CATS:
            cid, cname_pl = BILL_CATS[label]
            if cid not in [b["id"] for b in bill_categories]:
                bill_categories.append({"id": cid, "name": cname_pl})
            for m, col in month_cols.items():
                v = wv.cell(r, col).value
                if isinstance(v, (int, float)) and v != 0:
                    add({"id": f"imp-{mkey(m)}-bill-{cid}", "type": "bill", "month": mkey(m),
                         "amount": grosze(v), "category": cid})

    # ---- expenses (Item / Cena pairs) ------------------------------------
    rw = title_rows.get("wydatki")
    if rw is None:
        for row in ws.iter_rows():
            for c in row:
                if norm(c.value) == "wydatki" and c.row > r2:
                    rw = c.row
    series_count = {}
    pending = []
    if rw:
        for r in range(rw, ws.max_row + 1):
            if norm(ws.cell(r, 4).value) != "item":
                continue
            for m, col in month_cols.items():
                name = ws.cell(r, col).value
                if not name:
                    continue
                raw = ws.cell(r + 1, col).value
                val = wv.cell(r + 1, col).value
                note = None
                if isinstance(raw, str) and raw.startswith("="):
                    note = raw[1:].replace(".", ",").replace("+", " + ")
                if isinstance(val, (int, float)):
                    amount = grosze(val)
                elif isinstance(raw, str) and raw.strip():
                    amount, note = 0, raw.strip()
                else:
                    if str(name).strip():
                        series_count[norm(name)] = series_count.get(norm(name), 0) + 1
                    continue
                name = str(name).strip()
                pending.append((m, r, name[:1].upper() + name[1:], amount, note))
                series_count[norm(name)] = series_count.get(norm(name), 0) + 1
    seen = {}
    for m, r, name, amount, note in sorted(pending, key=lambda p: (p[0], p[1])):
        e = {"id": f"imp-{mkey(m)}-exp-{slug(name)[:40]}", "type": "expense", "month": mkey(m),
             "amount": amount, "title": name}
        if note:
            e["note"] = note
        total = series_count.get(norm(name), 1)
        if total >= 3:  # same item bought every month -> installments
            idx = seen[norm(name)] = seen.get(norm(name), 0) + 1
            e["series"] = {"id": f"imp-{year}-{slug(name)}", "index": idx, "count": total}
            e["id"] += f"-{idx}"
        add(e)

    # ---- mortgage block --------------------------------------------------
    mortgage = {}
    contributions = []
    for row in ws.iter_rows():
        for c in row:
            t = norm(c.value)
            if c.column < 20:
                continue
            val = wv.cell(c.row, 23).value
            if t == "total" and isinstance(val, (int, float)):
                mortgage["propertyValue"] = grosze(val)
            elif t == "kredyt" and isinstance(val, (int, float)):
                mortgage["principal"] = grosze(val)
            elif t == "depozyt" and isinstance(val, (int, float)):
                mortgage["downPayment"] = grosze(val)
            elif slug(t) in [p["id"] for p in people]:
                own = wv.cell(c.row, 22).value
                if isinstance(own, (int, float)):
                    contributions.append({"person": slug(t), "amount": grosze(own)})
    mortgage["contributions"] = contributions

    # ---- the sheet's own results, for parity tests (DOCHÓD VS OPŁATY) ----
    checks = {}
    person_keys = {"dochód": "income", "opłaty": "costs", "reszta": "left"}
    all_keys = {"dochód": "income", "opłaty": "bills", "wydatki": "expenses", "opłaty total": "out", "reszta": "left"}
    end = rw if rw else ws.max_row
    who = None
    for r in range(r2 + 1, end):
        cname, label = ws.cell(r, 3).value, norm(ws.cell(r, 4).value)
        if cname and not isinstance(cname, (int, float)):
            who = "all" if norm(cname) == "razem" else slug(cname)
        keys = all_keys if who == "all" else person_keys
        if not who or label not in keys:
            continue
        for m, col in month_cols.items():
            v = wv.cell(r, col).value
            if isinstance(v, (int, float)):
                checks.setdefault(mkey(m), {}).setdefault(who, {})[keys[label]] = grosze(v)

    out = {"year": year, "people": people, "billCategories": bill_categories,
           "entries": entries, "mortgage": mortgage, "checks": checks}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    kinds = {}
    for e in entries:
        kinds[e["type"]] = kinds.get(e["type"], 0) + 1
    print(f"{len(entries)} wpisów {kinds}, osoby: {[p['name'] for p in people]}, kredyt: {mortgage}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
