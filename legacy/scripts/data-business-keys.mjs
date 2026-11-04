// Scope/scenario are part of every key: independent samples are never deduplicated across scopes.
export const businessKeys={
 T01:['product_id','variant_id','valid_from'],T02:['mapping_kind','entity_ref','external_system','external_value','country_code','language','valid_from'],
 T03:['subject_ref','period','region_ref','retail_channel','coverage_id','measurement_method','projection_version'],
 T04:['panel_id','cohort_id','subject_ref','period','weighting_method'],T05:['query_id','term_ref','period','index_definition','normalization_scope','search_surface'],
 T06:['keyword','language','geo_target_ref','period','network_scope'],T07:['site_ref','period','query','page_ref','device','search_type','aggregation_scope'],
 T08:['offer_id','variant_ref','seller_ref','observed_at','pack_quantity'],T09:['promotion_id','product_refs','seller_ref','period'],
 T10:['advertiser_ref','public_ad_id','observed_at','served_regions','coverage_text'],T11:['document_id','publisher','published_at'],
 T12:['platform','account_id','campaign_id','period'],T13:['platform','account_id','campaign_ref','entity_level','entity_id','period','report_state','conversion_definition_ref','attribution_model','attribution_window'],
 T14:['campaign_ref','period','breakdown_dimensions','report_definition_ref','audience_basis','parent_report_ref'],T15:['campaign_ref','competitor_domain','period','report_surface'],
 T16:['creative_id','version','valid_from','valid_to_exclusive'],T17:['event_id'],T18:['event_id','item_index','measurement_basis'],
 T19:['order_id','line_id'],T20:['adjustment_id'],T21:['variant_ref','period','margin_definition','accounting_basis'],T22:['variant_ref','location_ref','observed_at'],
 T23:['record_kind','order_ref','promised_at','shipped_at','location_ref','product_ref','period','retail_channel'],
 T24:['review_id','review_subject_type','subject_ref'],T25:['record_kind','review_ref','subject_ref','aspect_ref','evidence_span','extractor_version','definition_version','assessment_status'],
 T26:['ticket_id'],T27:['content_id','platform','channel_ref','observed_at'],T28:['comment_id','content_ref'],T29:['collaboration_id'],
 T30:['record_kind','cohort_ref','period','acquisition_channel'],T31:['crm_campaign_id','segment_ref','sent_at','period','open_measurement_basis'],
 T32:['study_id','subject_ref','period','question_text','measure_definition','cohort_ref','sampling_method'],T33:['statistics_table_id','item_code','region_ref','period','unit','definition','published_at','seasonal_adjustment'],
 T34:['record_kind','region_ref','period','station_ref','event_name','calendar_kind'],T35:['change_id','entity_ref','changed_at','changed_field'],T36:['run_id','target_dataset','expected_period'],
 T37:['record_kind','page_ref','device','incident_start','incident_end','period'],T38:['experiment_id','arm_id','period','assignment_method','assignment_unit'],
 T39:['record_kind','model_ref','model_version','validity_scope','scenario_id_ref','period'],T40:['policy_id','version','period'],
 H01:['report_kind','subject_ref','period','metric_definition_refs','reconciliation'],
};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const businessKey=r=>JSON.stringify(stable(Object.fromEntries(['dataset_type','scope_id','scenario_id',...businessKeys[r.dataset_type]].map(k=>[k,r[k]??null]))));
