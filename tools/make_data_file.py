#!/usr/bin/env python3
"""Build the shared budget file (budzet.json) from the converted spreadsheet.

  python3 -I tools/xlsx_to_json.py budget.xlsx seed.json
  python3 -I tools/make_data_file.py seed.json budzet.json \
      --rate 6.13 --fixed-until 2030-12 --term 360 \
      --balance 480000.00 --balance-month 2026-10 --remaining 300

The output is what the app keeps in the private repository ("Wczytaj dane z pliku"
also accepts it). Amounts are in grosze; mortgage figures come from the bank app.
"""
import argparse
import json
import time

TONES = ["indigo", "clay"]


def grosze(text):
    return int(round(float(str(text).replace(" ", "").replace(",", ".")) * 100))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("seed")
    ap.add_argument("out")
    ap.add_argument("--rate", type=float, required=True, help="annual rate in percent")
    ap.add_argument("--term", type=int, default=360, help="installments in the agreement")
    ap.add_argument("--first", help="first installment YYYY-MM (default: January of the sheet year)")
    ap.add_argument("--kind", choices=["annuity", "decreasing"], default="annuity")
    ap.add_argument("--effect", choices=["shorten", "lower"], default="shorten")
    ap.add_argument("--fixed-until", help="last month of the fixed rate, YYYY-MM")
    ap.add_argument("--balance", help="principal left to repay, from the bank")
    ap.add_argument("--balance-month", help="month of that balance, YYYY-MM")
    ap.add_argument("--remaining", type=int, help="installments left after that month")
    a = ap.parse_args()

    seed = json.load(open(a.seed, encoding="utf-8"))
    now = int(time.time() * 1000)
    m = seed.get("mortgage", {})
    mortgage = {
        "propertyValue": m.get("propertyValue", 0),
        "principal": m.get("principal", 0),
        "contributions": m.get("contributions", []),
        "annualRate": a.rate,
        "termMonths": a.term,
        "firstPayment": a.first or f"{seed['year']}-01",
        "kind": a.kind,
        "overpayEffect": a.effect,
        "balance": None,
        "rateFixedUntil": a.fixed_until,
        "confirmed": True,
        "updatedAt": now,
        "updatedBy": "import",
    }
    if a.balance:
        mortgage["balance"] = {"amount": grosze(a.balance), "month": a.balance_month}
        if a.remaining:
            mortgage["balance"]["remaining"] = a.remaining

    household = {
        "schema": 1,
        "app": "money-home",
        "people": [{"id": p["id"], "name": p["name"], "tone": TONES[i % 2]} for i, p in enumerate(seed["people"][:2])],
        "billCategories": seed["billCategories"],
        "mortgage": mortgage,
        "meta": {"createdAt": now, "updatedAt": now, "peopleUpdatedAt": now, "categoriesUpdatedAt": now},
        "entries": seed["entries"],
    }
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(household, f, ensure_ascii=False, indent=1)
    print(f"{a.out}: {len(household['entries'])} wpisów, osoby: {[p['name'] for p in household['people']]}")


if __name__ == "__main__":
    main()
