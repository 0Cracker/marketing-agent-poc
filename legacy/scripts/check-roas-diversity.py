"""Independent Decimal and diversity checks. Reads observations, never creates them."""
import argparse
import hashlib
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENARIOS = {"R002-cost-change", "R003-order-value", "R004-adjustment-change"}
ZERO = Decimal(0)


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def money(item):
    assert item["currency"] == "KRW"
    value = Decimal(item["amount"])
    assert value.is_finite() and value >= 0 and value.as_tuple().exponent >= -2
    return value


def stamp(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    assert result.tzinfo is not None
    return result


def ratio(a, b):
    return a / b if b else None


def validate(records, profiles):
    rows = [row for row in records if row.get("scenario_id") in SCENARIOS]
    assert 0 < len(rows) <= 12000
    by_id = {row["record_id"]: row for row in records}
    assert len(by_id) == len(records), "duplicate_record_id"
    assert {row["scenario_id"] for row in rows} == SCENARIOS
    assert {profile["scenario_id"] for profile in profiles if profile["scenario_id"] in SCENARIOS} == SCENARIOS
    result = {}
    for profile in profiles:
        scenario = profile["scenario_id"]
        if scenario not in SCENARIOS:
            continue
        sample = [row for row in rows if row["scenario_id"] == scenario]
        typed = defaultdict(list)
        cutoff = stamp(profile["default_as_of"])
        for row in sample:
            typed[row["dataset_type"]].append(row)
            assert row["is_synthetic"] is True and row["value_origin"] == "simulation"
            assert row["scope_id"] in profile["scope_ids"]["KR"]
            for ref in row.get("related_record_ids", []):
                assert ref in by_id, (scenario, "missing_reference", ref)
                assert by_id[ref].get("scenario_id") == scenario or by_id[ref]["dataset_type"] == "T01"
        assert dict(Counter(row["dataset_type"] for row in sample)) == profile["counts"]
        visits = typed["T17"]
        assert len({row["session_ref"] for row in visits}) == len(visits)
        assert len({row["user_pseudo_ref"] for row in visits}) < len(visits), "no_returning_visitors"
        assert {row["device"] for row in visits} == {"mobile", "desktop"}
        cadence = Counter((row["event_time"][:10], row.get("utm_campaign")) for row in visits if row["traffic_medium"] == "paid")
        assert len(set(cadence.values())) >= 3, "constant_daily_traffic"
        events = defaultdict(dict)
        for event in typed["T18"]:
            if event["event_name"] == "refund":
                continue
            assert event["event_name"] not in events[event["session_ref"]]
            events[event["session_ref"]][event["event_name"]] = event
        for visit in visits:
            previous = stamp(visit["event_time"])
            missing = False
            steps = ("view_item", "add_to_cart", "begin_checkout", "purchase") if visit["traffic_medium"] == "paid" else ("begin_checkout", "purchase")
            for name in steps:
                event = events[visit["session_ref"]].get(name)
                if event is None:
                    missing = True
                    continue
                assert not missing, (scenario, "nonsequential_funnel")
                if visit.get("utm_campaign"):
                    assert event["campaign_ref"] == visit["utm_campaign"]
                assert stamp(event["event_time"]) >= previous
                previous = stamp(event["event_time"])
        assert any("view_item" not in events[row["session_ref"]] for row in visits), "all_visits_view_product"
        orders = typed["T19"]
        assert len({row["order_id"] for row in orders}) == len(orders)
        assert len({row["quantity"] for row in orders}) >= 3, "constant_order_quantity"
        assert len({money(row["line_discount"]) for row in orders}) >= 3, "constant_discount"
        delays = set()
        sessions = {row["session_ref"]:row for row in visits}
        for order in orders:
            visit = by_id[order["acquisition_ref"]]
            assert visit["traffic_medium"] == "paid"
            purchases = [event for event in typed["T18"] if event["event_name"] == "purchase" and event["transaction_ref"] == order["transaction_ref"]]
            assert len(purchases) == 1
            event = purchases[0]
            purchase_visit = sessions[event["session_ref"]]
            assert event["campaign_ref"] == visit["utm_campaign"]
            assert money(event["unit_price"]) == money(order["unit_price"])
            if purchase_visit["record_id"] != visit["record_id"]:
                assert purchase_visit["traffic_medium"] == "direct"
                assert visit["record_id"] in purchase_visit["related_record_ids"]
                assert visit["user_pseudo_ref"] and purchase_visit["user_pseudo_ref"] == visit["user_pseudo_ref"]
                assert not any(other["traffic_medium"] == "paid" and other["user_pseudo_ref"] == visit["user_pseudo_ref"] and stamp(visit["event_time"]) < stamp(other["event_time"]) <= stamp(order["ordered_at"]) for other in visits), "intervening_paid_touch"
            assert event["transaction_ref"] == order["transaction_ref"]
            assert event["event_time"] == order["ordered_at"]
            assert event["quantity"] == order["quantity"]
            delay = (stamp(order["ordered_at"]) - stamp(visit["event_time"])).total_seconds()
            assert 0 <= delay <= 7 * 86400
            delays.add(delay)
            subtotal = money(order["unit_price"]) * order["quantity"] - money(order["line_discount"])
            assert subtotal >= 0
            assert money(order["line_gross_total"]) - money(order["line_tax"]) == subtotal
        assert len(delays) >= 3, "constant_purchase_delay"
        feedback = typed["T24"] + typed["T26"]
        assert typed["T24"] and typed["T26"]
        texts = [row.get("body_text", row.get("message_text", "")) for row in feedback]
        assert all(texts) and len(set(texts)) / len(texts) >= .8, "repeated_feedback_templates"
        assert any(row.get("link_status") == "unlinked" for row in feedback), "no_unlinked_feedback"
        for ad in typed["T13"]:
            children = [row for row in typed["T14"] if row["parent_report_ref"] == ad["record_id"]]
            assert len(children) == 2
            assert {d["value"] for row in children for d in row["breakdown_dimensions"] if d["name"] == "device"} == {"mobile", "desktop"}
            for field in ("spend", "attributed_value"):
                assert sum((money(row["metrics"][field]) for row in children), ZERO) == money(ad["metrics"][field])
            for field in ("impressions", "clicks", "attributed_conversions"):
                assert sum(row["metrics"][field] for row in children) == ad["metrics"][field]
            selected = [row for row in orders if by_id[row["acquisition_ref"]]["utm_campaign"] == ad["campaign_ref"] and by_id[row["acquisition_ref"]]["event_time"][:10] == ad["period"]["start"]]
            assert len(selected) == ad["metrics"]["attributed_conversions"]
            assert sum((money(row["unit_price"])*row["quantity"]-money(row["line_discount"]) for row in selected),ZERO) == money(ad["metrics"]["attributed_value"])
            for child in children:
                device = next(d["value"] for d in child["breakdown_dimensions"] if d["name"] == "device")
                partition = [row for row in selected if by_id[row["acquisition_ref"]]["device"] == device]
                paid_visits = [row for row in visits if row["traffic_medium"] == "paid" and row["utm_campaign"] == ad["campaign_ref"] and row["event_time"][:10] == ad["period"]["start"] and row["device"] == device]
                assert child["metrics"]["clicks"] >= len(paid_visits), (scenario,"device_clicks_less_than_paid_sessions",ad["record_id"],device)
                assert len(partition) == child["metrics"]["attributed_conversions"]
                assert sum((money(row["unit_price"])*row["quantity"]-money(row["line_discount"]) for row in partition),ZERO) == money(child["metrics"]["attributed_value"])
        assert len({row["metrics"]["impressions"] for row in typed["T13"]}) >= 3
        assert len({money(row["metrics"]["spend"]) for row in typed["T13"]}) >= 3
        losses = defaultdict(Decimal)
        aliases = pending = late = 0
        for adjustment in typed["T20"]:
            linked = [by_id[ref] for ref in adjustment.get("related_record_ids", []) if by_id[ref]["dataset_type"] == "T20"]
            if linked:
                assert len(linked) == 1 and adjustment["adjustment_kind"] == "return"
                assert linked[0]["order_ref"] == adjustment["order_ref"]
                assert linked[0]["status"] == "completed" and linked[0]["adjustment_kind"] in ("cancel", "refund")
                aliases += 1
                continue
            if adjustment["status"] != "completed":
                pending += 1
                continue
            if stamp(adjustment["processed_at"]) > cutoff:
                late += 1
                continue
            if adjustment["adjustment_kind"] in ("cancel", "refund"):
                assert stamp(adjustment["requested_at"]) <= stamp(adjustment["processed_at"])
                losses[adjustment["order_ref"]] += money(adjustment["refund_amount"])
        assert aliases and pending and late, "financial_edge_cases_missing"
        periods = []
        for period in (profile["baseline"], profile["observed"]):
            chosen = [row for row in orders if period["start"] <= by_id[row["acquisition_ref"]]["event_time"][:10] < period["end"]]
            ads = [row for row in typed["T13"] if period["start"] <= row["period"]["start"] < period["end"]]
            gross = sum((money(row["unit_price"]) * row["quantity"] - money(row["line_discount"]) for row in chosen), ZERO)
            spend = sum((money(row["metrics"]["spend"]) for row in ads), ZERO)
            loss = sum((losses[row["order_id"]] for row in chosen), ZERO)
            for row in chosen:
                assert losses[row["order_id"]] <= money(row["unit_price"]) * row["quantity"] - money(row["line_discount"])
            assert sum((money(row["metrics"]["attributed_value"]) for row in ads), ZERO) == gross
            assert sum(row["metrics"]["attributed_conversions"] for row in ads) == len(chosen)
            clicks = sum(row["metrics"]["clicks"] for row in ads)
            periods.append({"orders": len(chosen), "gross": gross, "spend": spend, "loss": loss, "net": gross-loss,
                            "cpc": ratio(spend, Decimal(clicks)), "orderValue": ratio(gross, Decimal(len(chosen))), "adjustmentRate": ratio(loss, gross)})
        a, b = periods
        # These are numeric contrasts, never assertions of a real causal ground truth.
        if scenario == "R002-cost-change":
            assert b["cpc"] > a["cpc"] * Decimal("1.2"), "cost_contrast_missing"
        elif scenario == "R003-order-value":
            assert b["orderValue"] < a["orderValue"] * Decimal(".85"), "order_value_contrast_missing"
        else:
            assert b["adjustmentRate"] > a["adjustmentRate"] + Decimal(".08"), "adjustment_contrast_missing"
        result[scenario] = {"rows":len(sample), "uniqueFeedback":len(set(texts)), "purchaseDelays":len(delays), "financialEdges":{"aliases":aliases,"pending":pending,"afterCutoff":late}, "periods":periods}
    return {"pass":True,"newRows":len(rows),"cases":result,"limitation":"Synthetic numeric contrasts do not establish real-world causes or representativeness."}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", help="Generated JSON path, or - for stdin; default reads installed data")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.input:
        payload = json.load(sys.stdin) if args.input == "-" else read(Path(args.input))
        result = validate(payload["records"],payload["profiles"])
    else:
        manifest = read(ROOT / "data/manifest.json")
        records = [json.loads(line) for file in manifest["files"] for line in (ROOT / "data" / file["file"]).read_text(encoding="utf-8").splitlines() if line]
        metadata = read(ROOT / "data/definitions.json")
        result = validate(records,metadata["scenario_profiles"])
        baseline = read(ROOT / "evidence/roas-diversity-20261022/baseline.json")
        assert baseline["rows"] == 33797
        digest = lambda data: hashlib.sha256(data).hexdigest()
        for name, prior in baseline["files"].items():
            raw = (ROOT / "data" / name).read_bytes()
            assert len(raw) >= prior["bytes"] and digest(raw[:prior["bytes"]]) == prior["sha256"], ("original_prefix_modified",name)
            assert len(raw[:prior["bytes"]].splitlines()) == prior["rows"]
        original = baseline["definitions"]
        canonical = json.dumps(metadata["definitions"][:original["count"]],ensure_ascii=False,separators=(",",":"))
        assert digest(canonical.encode()) == original["prefixSha256"], "old_definitions_modified"
        assert metadata["scenario_profiles"][:len(original["profiles"])] == original["profiles"], "old_profiles_modified"
        assert {key:value for key,value in metadata.items() if key not in ("definitions","scenario_profiles")} == original["otherKeys"]
        for file in manifest["files"]:
            raw = (ROOT / "data" / file["file"]).read_bytes()
            assert len(raw) == file["bytes"] and digest(raw) == file["sha256"]
        assert len(records) == manifest["rows"] == baseline["rows"] + result["newRows"]
        inventory = read(ROOT / "data/archive/source-inventory.json")
        # Support the inventory's existing list or wrapper without changing its contract.
        entries = inventory if isinstance(inventory,list) else inventory.get("sources",inventory.get("files",[]))
        assert all(entry in entries for entry in baseline["sourceInventory"]), "old_source_inventory_modified"
        result["originalRowsBytePreserved"] = baseline["rows"]
        result["dataHash"] = manifest["data_sha256"]
    encoded = json.dumps(result,ensure_ascii=False,indent=2,default=str)+"\n"
    if args.output:
        with args.output.open("x",encoding="utf-8") as output:
            output.write(encoded)
    print(encoded,end="")


if __name__ == "__main__":
    main()
