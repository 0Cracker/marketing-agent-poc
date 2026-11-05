// Scope selection follows physical-file validation; independent samples never add up.
export function selectScenario(records, scopeIds, scenarioId) {
  const scopes = new Set(Object.values(scopeIds).flat());
  if (!scopes.size) throw Error('scenario_scope_required');
  return records.filter(record => record.dataset_type === 'T01' ||
    (scopes.has(record.scope_id) && (!scenarioId || record.scenario_id === scenarioId)));
}
