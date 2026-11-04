"""Independent Decimal checks against actual loader projections; creates no observations."""
import hashlib
import json
import subprocess
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IDS = [f"S{i:02}" for i in range(1, 19)]
script = """
import {trainingScreenData} from './scripts/training-data.mjs';
console.log(JSON.stringify(Array.from({length:18},(_,i)=>{
 const id='S'+String(i+1).padStart(2,'0');
 return {initial:trainingScreenData(undefined,id,'initial'),mature:trainingScreenData(undefined,id,'mature')};
})));
"""
completed = subprocess.run(["node", "--input-type=module", "-e", script], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", check=True, timeout=120)
packs = json.loads(completed.stdout)
checks = 0


def verify(condition, label):
    global checks
    assert condition, label
    checks += 1


def total(rows, field):
    return sum((Decimal(str(row[field])) for row in rows), Decimal(0))


def rows(pack, period="current"):
    return [row for row in pack["facts"] if row["periodId"] == period]


expected = {
    "S01": (1800000, 120, 40000), "S02": (1200000, 72, 40000),
    "S03": (1200000, 120, 28000), "S04": (1200000, 168, 40000),
    "S05": (1200000, 72, 40000), "S06": (600000, 84, 40000),
    "S07": (1200000, 90, 40000), "S08": (2400000, 180, 40000),
    "S09": (1200000, 80, 40000), "S10": (2400000, 144, 40000),
    "S11": (1200000, 72, 40000), "S12": (1200000, 84, 50000),
    "S13": (1200000, 72, 40000), "S14": (1200000, 72, 40000),
    "S15": (1200000, 72, 40000),
}
numeric = ["impressions", "clicks", "spend", "sessions", "view", "cart", "checkout", "purchases", "returnPurchases", "orders", "units", "listRevenue", "discount", "revenue", "ledgerOrders", "ledgerRevenue", "paymentAttempts", "paymentFailures", "redirectErrors", "loadTotalMs", "loadSamples", "trackingExpected", "trackingReceived", "duplicateEvents"]
reference = packs[0]["initial"]
categories = {row["category"] for row in reference["records"]}

for case_id, pair in zip(IDS, packs, strict=True):
    initial, mature = pair["initial"], pair["mature"]
    verify(initial["caseId"] == case_id, case_id)
    verify(set(initial) == set(reference), case_id + " common schema")
    verify({row["category"] for row in initial["records"]} == categories, case_id + " record coverage")
    verify(len(initial["facts"]) == 336, case_id + " daily grain")
    verify(len({row["date"] for row in initial["facts"]}) == 28, case_id + " days")
    selected = rows(initial)
    if case_id in expected:
        verify(total(rows(initial, "baseline"), "spend") == 1200000, case_id + " baseline spend")
        verify(total(rows(initial, "baseline"), "orders") == 120, case_id + " baseline orders")
        spend, orders, aov = expected[case_id]
        verify(total(selected, "spend") == spend, case_id + " spend")
        verify(total(selected, "orders") == orders, case_id + " orders")
        verify(total(selected, "revenue") == orders * aov, case_id + " revenue")
    else:
        verify(total(rows(initial, "baseline"), "orders") > 500, case_id + " higher-volume baseline")
        aov = total(selected, "revenue") / total(selected, "orders")
    roas = total(selected, "revenue") / total(selected, "spend")
    cpc = total(selected, "spend") / total(selected, "clicks")
    cvr = total(selected, "orders") / total(selected, "clicks")
    verify(abs(roas - cvr * Decimal(aov) / cpc) < Decimal("1e-24"), case_id + " ROAS identity")
    for pack in (initial, mature):
        parents = {(r["date"], r["campaignId"], r["device"]): r for r in pack["facts"]}
        groups = defaultdict(list)
        for row in pack["breakdowns"]:
            groups[(row["dimension"], row["date"], row["campaignId"], row["device"])].append(row)
        dimensions = {row["dimension"] for row in pack["breakdowns"]}
        verify(dimensions == {row["dimension"] for row in reference["breakdowns"]}, case_id + " dimensions")
        for key, parent in parents.items():
            verify(all(isinstance(parent[field], int) and parent[field] >= 0 for field in numeric), case_id + " integer counts/money")
            verify(parent["sessions"] >= parent["view"] >= parent["cart"] >= parent["checkout"] >= parent["purchases"], case_id + " funnel")
            verify(parent["orders"] == parent["purchases"] + parent["returnPurchases"], case_id + " return bridge")
            verify(parent["revenue"] == parent["listRevenue"] - parent["discount"], case_id + " revenue bridge")
            for dimension in dimensions:
                children = groups[(dimension, *key)]
                verify(bool(children), case_id + " complete breakdown")
                verify(all(total(children, field) == parent[field] for field in numeric), case_id + " breakdown reconciliation")
    if case_id == "S15":
        verify(total(rows(initial), "ledgerOrders") == 72, "S15 no future ledger orders")
        verify(total(rows(initial), "returnPurchases") == 0, "S15 no future return purchases")
        verify(total(rows(mature), "orders") == 120, "S15 mature orders")
        verify(total(rows(mature), "returnPurchases") == 48, "S15 mature return purchases")
    else:
        verify(initial["facts"] == mature["facts"], case_id + " stable reporting")

tracking = packs[13]["initial"]
verify(total(rows(tracking), "ledgerOrders") == 120, "S14 ledger orders")
verify(total(rows(tracking), "ledgerRevenue") == 4800000, "S14 ledger revenue")
mix = packs[6]["initial"]
for campaign in mix["campaigns"]:
    before = [r for r in rows(mix, "baseline") if r["campaignId"] == campaign["id"]]
    after = [r for r in rows(mix) if r["campaignId"] == campaign["id"]]
    verify(total(before, "revenue") * total(after, "spend") == total(after, "revenue") * total(before, "spend"), "S07 stable campaign ROAS")

manifest = json.loads((ROOT / "data/manifest.json").read_text(encoding="utf-8"))
verify(manifest["rows"] == 41341, "preserved original rows")
snapshot = json.loads((ROOT / "evidence/training-dashboard-20261023/baseline.json").read_text(encoding="utf-8"))
for info in snapshot["files"]:
    filename = info["file"]
    if filename == "manifest.json":
        continue
    expected_hash = info["sha256"]
    verify(hashlib.sha256((ROOT / "data" / filename).read_bytes()).hexdigest() == expected_hash, "preserved bytes " + filename)
for item in manifest["metadata"]:
    verify(hashlib.sha256((ROOT / "data" / item["file"]).read_bytes()).hexdigest() == item["sha256"], "metadata hash " + item["file"])
verify(next(item for item in manifest["metadata"] if item["file"] == "training-dashboard.json")["public"] is False, "private source pack")
print(json.dumps({"status": "passed", "cases": len(IDS), "checks": checks, "method": "independent Decimal and integer aggregation", "scope": "mock consistency, not real marketer learning efficacy"}, ensure_ascii=False))
