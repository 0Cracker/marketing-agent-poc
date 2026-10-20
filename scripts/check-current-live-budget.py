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
results = {}
with localcontext() as context:
    context.prec = 60
    for arm in ("baseline", "candidate"):
        amounts = [Decimal(row["amount"]["amount"]) for row in simulation[arm]["allocations"]]
        expected = sum((parameters["scale"] * amount / (parameters["saturation"] + amount) for amount in amounts), Decimal(0))
        expected = expected.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        assert expected == Decimal(simulation[arm]["expected"]), arm
        results[arm] = {"expected": str(expected), "total": str(sum(amounts)), "currency": sorted({row["amount"]["currency"] for row in simulation[arm]["allocations"]})}
assert Decimal(results["baseline"]["total"]) == Decimal(results["candidate"]["total"])
assert results["baseline"]["currency"] == results["candidate"]["currency"] == ["JPY"]
assert simulation["realExecutionAllowed"] is False
print(json.dumps({"pass": True, "modelId": model["record_id"], "period": simulation["period"], "results": results}, ensure_ascii=False))
