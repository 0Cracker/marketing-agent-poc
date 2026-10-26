// Selection is explicit: page-wide KPI evidence must not inherit a local channel filter.
export function selectRoasEvidence(records, report, {channel = 'all', types = [], ids} = {}) {
  const byId = new Map(records.map(row => [row.record_id, row]));
  if (ids) {
    const wanted = new Set(ids);
    for (const id of ids) for (const ref of byId.get(id)?.related_record_ids || []) wanted.add(ref);
    return records.filter(row => wanted.has(row.record_id));
  }
  const channels = report.periods.flatMap(period => period.channels.filter(row => channel === 'all' || row.channel === channel));
  const campaigns = new Set(channels.map(row => row.campaignId));
  const ads = new Set(channels.flatMap(row => row.evidence.adRecordIds));
  const orders = new Set(channels.flatMap(row => row.evidence.orderRecordIds));
  const adjustments = new Set(channels.flatMap(row => row.evidence.adjustmentRecordIds));
  const cutoff = Date.parse(report.asOf);
  const available = time => typeof time === 'string' && Date.parse(time) <= cutoff;
  const compared = time => typeof time === 'string' && report.periods.some(({period}) => time.slice(0, 10) >= period.start && time.slice(0, 10) < period.end);
  const visits = records.filter(row => row.dataset_type === 'T17' && campaigns.has(row.utm_campaign) && row.traffic_medium === 'paid' && compared(row.event_time) && available(row.event_time));
  const sessions = new Set(visits.map(row => row.session_ref).filter(Boolean));
  const visitIds = new Set(visits.map(row => row.record_id));
  return records.filter(row => {
    if (!types.includes(row.dataset_type)) return false;
    switch (row.dataset_type) {
      case 'T12': return campaigns.has(row.campaign_id);
      case 'T13': return ads.has(row.record_id);
      case 'T17': return visitIds.has(row.record_id);
      case 'T18': return sessions.has(row.session_ref) && campaigns.has(row.campaign_ref) && available(row.event_time);
      case 'T19': return orders.has(row.record_id);
      // Refunds follow their original order cohort, even when processed after its period.
      case 'T20': return adjustments.has(row.record_id) && available(row.processed_at || row.requested_at);
      default: return false;
    }
  });
}


export function roasEvidenceTime(row) {
 return String(row.ordered_at || row.processed_at || row.requested_at || row.event_time || row.written_at || row.created_at || row.period?.start || '');
}

// The period filter uses the source event date; refund processing can be outside the order cohort.
export function filterRoasEvidence(records, periods, {query='', period='all', type='all', sort='desc'}={}) {
 return records.filter(row=>{
  if(type!=='all'&&row.dataset_type!==type)return false;
  const day=roasEvidenceTime(row).slice(0,10);
  const index=periods.findIndex(({period})=>day>=period.start&&day<period.end);
  return (period==='all'||index===Number(period))&&JSON.stringify(row).toLowerCase().includes(query.toLowerCase());
 }).toSorted((a,b)=>sort==='asc'?roasEvidenceTime(a).localeCompare(roasEvidenceTime(b)):roasEvidenceTime(b).localeCompare(roasEvidenceTime(a)));
}
