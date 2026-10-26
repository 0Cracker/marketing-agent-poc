"""Independent Decimal verification; reads approved files, never generates observations."""
import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

root = Path(__file__).resolve().parent.parent
data = root / "data"
evidence = root / "evidence/roas-decision-flow-20261021"
read = lambda file: json.loads(file.read_text(encoding="utf-8"))
lines = lambda file: [json.loads(line) for line in file.read_text(encoding="utf-8").splitlines() if line]
digest = lambda value: hashlib.sha256(value).hexdigest()
manifest = read(data / "manifest.json")
generation = read(evidence / "generation.json")
report = read(evidence / "scenario-analysis-final.json")
records = [row for file in manifest["files"] for row in lines(data / file["file"])]
by_id = {row["record_id"]: row for row in records}
sample = [row for row in records if row["scenario_id"] == "R001-roas-decline"]
assert len(sample) == 3470
assert dict(Counter(row["dataset_type"] for row in sample)) == generation["counts"]
diversity_dir=root / "evidence/roas-diversity-20261022"
diversity_generation=read(diversity_dir / "generation.json") if (diversity_dir / "generation.json").exists() else None
diversity_baseline=read(diversity_dir / "baseline.json") if diversity_generation else None
assert len(records) == manifest["rows"] == 33797 + (diversity_generation["newRows"] if diversity_generation else 0)
assert len(by_id) == len(records)
assert report["dataHash"] == (diversity_baseline["dataHash"] if diversity_baseline else manifest["data_sha256"])

# Compare the exact old byte prefixes, including their original newline encoding.
for file in manifest["files"]:
    raw = (data / file["file"]).read_bytes()
    added = generation["counts"].get(file["type"], 0)
    original_rows = (diversity_baseline["files"][file["file"]]["rows"] if diversity_baseline else file["rows"]) - added
    prefix = b"".join(raw.splitlines(keepends=True)[:original_rows])
    assert digest(prefix) == generation["beforeFiles"][file["file"]], file["file"]
    assert digest(raw) == file["sha256"]

metadata = read(data / "definitions.json")
original_metadata = {key: value for key, value in metadata.items() if key != "scenario_profiles"}
original_metadata["definitions"] = [item for item in metadata["definitions"] if not item["id"].startswith(("R001-", "R002-", "R003-", "R004-"))]
assert digest((json.dumps(original_metadata, ensure_ascii=False, indent=2, separators=(",", ": ")) + "\n").encode()) == generation["beforeFiles"]["definitions.json"]
assert metadata["scenario_profiles"][0]["scope_ids"]["KR"] == ["R001-KR-paid-p1a"]
assert manifest["scope_ids"]["KR"] == ["D008-KR-sample"]

typed = defaultdict(list)
for row in sample:
    typed[row["dataset_type"]].append(row)
    assert row["is_synthetic"] is True
    for ref in row.get("related_record_ids", []):
        assert ref in by_id
        assert by_id[ref]["scenario_id"] == row["scenario_id"]

def value(money):
    assert money["currency"] == "KRW"
    result = Decimal(money["amount"])
    assert result >= 0 and result.as_tuple().exponent >= -2
    return result

orders = {row["order_id"]: row for row in typed["T19"]}
transactions = {row["transaction_ref"]: row for row in typed["T19"]}
assert len(orders) == len(transactions) == 126
events = defaultdict(dict)
for event in typed["T18"]:
    if event["event_name"] != "refund":
        assert event["event_name"] not in events[event["session_ref"]]
        events[event["session_ref"]][event["event_name"]] = event
    if event["event_name"] == "purchase":
        order = transactions[event["transaction_ref"]]
        visit = by_id[order["acquisition_ref"]]
        assert event["session_ref"] == visit["session_ref"]
        assert event["variant_ref"] == order["variant_ref"]
        assert event["quantity"] == order["quantity"]
        assert event["event_time"] == order["ordered_at"]
        assert event["campaign_ref"] == visit["utm_campaign"]
        assert event["event_time"][:10] == visit["event_time"][:10]
for visit in typed["T17"]:
    previous = datetime.fromisoformat(visit["event_time"])
    missing = False
    for step in ("view_item", "add_to_cart", "begin_checkout", "purchase"):
        event = events[visit["session_ref"]].get(step)
        if event is None:
            missing = True
            continue
        assert not missing
        timestamp = datetime.fromisoformat(event["event_time"])
        assert timestamp >= previous
        previous = timestamp

for ad in typed["T13"]:
    children = [row for row in typed["T14"] if row["parent_report_ref"] == ad["record_id"]]
    assert len(children) == 2
    for field in ("spend", "attributed_value"):
        assert sum(value(child["metrics"][field]) for child in children) == value(ad["metrics"][field])
    for field in ("clicks", "impressions", "attributed_conversions"):
        assert sum(child["metrics"][field] for child in children) == ad["metrics"][field]

loss_by_order = defaultdict(Decimal)
cutoff = datetime.fromisoformat(report["asOf"])
aliases = set()
for event in typed["T20"]:
    representatives = [by_id[ref] for ref in event["related_record_ids"] if by_id[ref]["dataset_type"] == "T20"]
    if representatives:
        assert len(representatives) == 1 and event["adjustment_kind"] == "return"
        representative = representatives[0]
        assert representative["order_ref"] == event["order_ref"]
        assert representative["status"] == "completed"
        aliases.add(event["record_id"])
        continue
    if event["status"] == "completed" and event["adjustment_kind"] in ("cancel", "refund"):
        if datetime.fromisoformat(event["processed_at"]) <= cutoff:
            loss_by_order[event["order_ref"]] += value(event["refund_amount"])
assert len(aliases) == 2
expected_periods = []
for actual in report["periods"]:
    expected_channels = []
    for channel in actual["channels"]:
        selected = [order for order in orders.values() if by_id[order["acquisition_ref"]]["utm_campaign"] == channel["campaignId"]
                    and actual["period"]["start"] <= by_id[order["acquisition_ref"]]["event_time"][:10] < actual["period"]["end"]]
        gross = sum((value(order["unit_price"]) * order["quantity"] - value(order["line_discount"]) for order in selected), Decimal(0))
        for order in selected:
            subtotal = value(order["line_gross_total"]) - value(order["line_tax"])
            assert subtotal == value(order["unit_price"]) * order["quantity"] - value(order["line_discount"])
            assert loss_by_order[order["order_id"]] <= subtotal
        net = gross - sum((loss_by_order[order["order_id"]] for order in selected), Decimal(0))
        assert Decimal(channel["purchaseCohort"]["netProductRevenue"]) == net
        assert Decimal(channel["reported"]["attributedRevenue"]) == gross
        assert channel["purchaseCohort"]["orders"] == len(selected)
        expected_channels.append(net)
    expected = sum(expected_channels)
    assert Decimal(actual["total"]["netProductRevenue"]) == expected
    expected_periods.append(str(expected))
for kind, bridge in report["roasBridge"].items():
    metric = "netRoas" if kind == "net" else "reportedRoas"
    assert abs(Decimal(str(bridge["withinChannelChange"])) + Decimal(str(bridge["spendMixChange"]))
               - (Decimal(str(report["periods"][1]["total"][metric])) - Decimal(str(report["periods"][0]["total"][metric])))) < Decimal("0.000000001")

result = {"pass": True, "newRows": len(sample), "existingRowsBytePreserved": 30327,
          "checks": ["counts", "old_file_prefix_hashes", "old_definitions_preserved", "default_scope_isolation",
                     "record_references", "purchase_order_session", "ordered_funnel", "device_partition",
                     "decimal_product_revenue", "independent_partial_refunds", "return_aliases", "cutoff", "reported_vs_net"],
          "expectedNetProductRevenue": expected_periods, "dataHash": manifest["data_sha256"]}
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path)
args = parser.parse_args()
if args.output:
    with args.output.open("x", encoding="utf-8") as output:
        json.dump(result, output, ensure_ascii=False, indent=2)
        output.write("\n")
print(json.dumps(result, ensure_ascii=False))
