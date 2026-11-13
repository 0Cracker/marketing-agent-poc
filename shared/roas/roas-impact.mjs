// ROAS units are ratios; return percentage-point contributions for one fixed scope.
export function roasScopeDeltaPp(baseline, current) {
  if (!(baseline.spend > 0 && current.spend > 0)) return null;
  return 100 * (current.revenue / current.spend - baseline.revenue / baseline.spend);
}

export function roasImpactPp(baseline, current, groupBaseline, groupCurrent) {
  if (!(baseline.spend > 0 && current.spend > 0)) return null;
  const averageRoas = (baseline.revenue / baseline.spend + current.revenue / current.spend) / 2;
  const revenueShareChange = groupCurrent.revenue / current.spend - groupBaseline.revenue / baseline.spend;
  const spendWeightChange = groupCurrent.spend / current.spend - groupBaseline.spend / baseline.spend;
  return 100 * (revenueShareChange - averageRoas * spendWeightChange);
}
