"""Independent Decimal readback of an existing synthetic simulation; no new inputs."""
import json
import sys
from decimal import Decimal, ROUND_HALF_UP, localcontext
from pathlib import Path

simulation = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
models = [json.loads(line) for line in Path(sys.argv[2]).read_text(encoding="utf-8").splitlines() if line.strip()]
model = next(row for row in models if row["record_id"] == simulation["modelId"])
assert model["formula"] == "scale * budget / (saturation + budget)"
parameters = {row["name"]: Decimal(row["value"]) for row in model["parameters"]}
assert len(parameters) == len(model["parameters"]), "duplicate parameters"
channel_specific = any("." in name for name in parameters)
# New simulations carry their exact per-arm campaign-to-channel mapping.
# Historical simulations have global parameters and need no campaign source file.
results = {}
with localcontext() as context:
    context.prec = 60
    for arm in ("baseline", "candidate"):
        amounts = [Decimal(row["amount"]["amount"]) for row in simulation[arm]["allocations"]]
        if channel_specific:
            grouped = {}
            for row in simulation[arm]["allocations"]:
                channel = simulation[arm]["campaignChannels"][row["campaign_ref"]]
                grouped[channel] = grouped.get(channel, Decimal(0)) + Decimal(row["amount"]["amount"])
            expected = sum((parameters[channel+".scale"] * amount / (parameters[channel+".saturation"] + amount) for channel, amount in grouped.items()), Decimal(0))
        else:
            expected = sum((parameters["scale"] * amount / (parameters["saturation"] + amount) for amount in amounts), Decimal(0))
        expected = expected.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        assert expected == Decimal(simulation[arm]["expected"]), arm
        results[arm] = {"expected": str(expected), "total": str(sum(amounts)), "currency": sorted({row["amount"]["currency"] for row in simulation[arm]["allocations"]})}
assert Decimal(results["baseline"]["total"]) == Decimal(results["candidate"]["total"])
assert results["baseline"]["currency"] == results["candidate"]["currency"]
assert len(results["baseline"]["currency"]) == 1
assert simulation["realExecutionAllowed"] is False
print(json.dumps({"pass": True, "modelId": model["record_id"], "period": simulation["period"], "results": results}, ensure_ascii=False))
