# 업무 유형·파일·식별키 매핑

공통 키는 `dataset_type` · `scope_id` · `scenario_id`다. 서로 다른 시나리오·표본을 자동 중복으로 삭제하지 않는다. 미제공 필드는 null로 비교하고 충돌 자료는 판정 보류로 남긴다.

| 유형 | 현재 파일 | 활성 행수 | 업무 식별 차원 |
| --- | --- | ---: | --- |
| T01 | products.jsonl | 6 | `product_id` · `variant_id` · `valid_from` |
| T02 | identity-mappings.jsonl | 108 | `mapping_kind` · `entity_ref` · `external_system` · `external_value` · `country_code` · `language` · `valid_from` |
| T03 | market-sales.jsonl | 432 | `subject_ref` · `period` · `region_ref` · `retail_channel` · `coverage_id` · `measurement_method` · `projection_version` |
| T04 | purchase-surveys.jsonl | 108 | `panel_id` · `cohort_id` · `subject_ref` · `period` · `weighting_method` |
| T05 | search-interest.jsonl | 216 | `query_id` · `term_ref` · `period` · `index_definition` · `normalization_scope` · `search_surface` |
| T06 | keyword-demand.jsonl | 216 | `keyword` · `language` · `geo_target_ref` · `period` · `network_scope` |
| T07 | organic-search.jsonl | 432 | `site_ref` · `period` · `query` · `page_ref` · `device` · `search_type` · `aggregation_scope` |
| T08 | prices.jsonl | 1,512 | `offer_id` · `variant_ref` · `seller_ref` · `observed_at` · `pack_quantity` |
| T09 | promotions.jsonl | 54 | `promotion_id` · `product_refs` · `seller_ref` · `period` |
| T10 | public-ads.jsonl | 156 | `advertiser_ref` · `public_ad_id` · `observed_at` · `served_regions` · `coverage_text` |
| T11 | publications.jsonl | 54 | `document_id` · `publisher` · `published_at` |
| T12 | campaigns.jsonl | 12 | `platform` · `account_id` · `campaign_id` · `period` |
| T13 | ad-performance.jsonl | 624 | `platform` · `account_id` · `campaign_ref` · `entity_level` · `entity_id` · `period` · `report_state` · `conversion_definition_ref` · `attribution_model` · `attribution_window` |
| T14 | ad-breakdowns.jsonl | 672 | `campaign_ref` · `period` · `breakdown_dimensions` · `report_definition_ref` · `audience_basis` · `parent_report_ref` |
| T15 | auction-insights.jsonl | 144 | `campaign_ref` · `competitor_domain` · `period` · `report_surface` |
| T16 | creatives.jsonl | 72 | `creative_id` · `version` · `valid_from` · `valid_to_exclusive` |
| T17 | web-events.jsonl | 4,600 | `event_id` |
| T18 | commerce-events.jsonl | 7,056 | `event_id` · `item_index` · `measurement_basis` |
| T19 | order-lines.jsonl | 1,712 | `order_id` · `line_id` |
| T20 | refunds.jsonl | 170 | `adjustment_id` |
| T21 | costs.jsonl | 144 | `variant_ref` · `period` · `margin_definition` · `accounting_basis` |
| T22 | inventory.jsonl | 336 | `variant_ref` · `location_ref` · `observed_at` |
| T23 | distribution-fulfilment.jsonl | 1,232 | `record_kind` · `order_ref` · `promised_at` · `shipped_at` · `location_ref` · `product_ref` · `period` · `retail_channel` |
| T24 | reviews.jsonl | 2,410 | `review_id` · `review_subject_type` · `subject_ref` |
| T25 | review-annotations.jsonl | 4,820 | `record_kind` · `review_ref` · `subject_ref` · `aspect_ref` · `evidence_span` · `extractor_version` · `definition_version` · `assessment_status` |
| T26 | customer-inquiries.jsonl | 386 | `ticket_id` |
| T27 | owned-content.jsonl | 108 | `content_id` · `platform` · `channel_ref` · `observed_at` |
| T28 | social-comments.jsonl | 1,078 | `comment_id` · `content_ref` |
| T29 | creator-collaborations.jsonl | 18 | `collaboration_id` |
| T30 | customer-cohorts.jsonl | 204 | `record_kind` · `cohort_ref` · `period` · `acquisition_channel` |
| T31 | crm-performance.jsonl | 204 | `crm_campaign_id` · `segment_ref` · `sent_at` · `period` · `open_measurement_basis` |
| T32 | brand-surveys.jsonl | 108 | `study_id` · `subject_ref` · `period` · `question_text` · `measure_definition` · `cohort_ref` · `sampling_method` |
| T33 | public-statistics.jsonl | 72 | `statistics_table_id` · `item_code` · `region_ref` · `period` · `unit` · `definition` · `published_at` · `seasonal_adjustment` |
| T34 | weather-calendar.jsonl | 168 | `record_kind` · `region_ref` · `period` · `station_ref` · `event_name` · `calendar_kind` |
| T35 | change-events.jsonl | 108 | `change_id` · `entity_ref` · `changed_at` · `changed_field` |
| T36 | collection-runs.jsonl | 216 | `run_id` · `target_dataset` · `expected_period` |
| T37 | site-events.jsonl | 23 | `record_kind` · `page_ref` · `device` · `incident_start` · `incident_end` · `period` |
| T38 | experiments.jsonl | 72 | `experiment_id` · `arm_id` · `period` · `assignment_method` · `assignment_unit` |
| T39 | budget-models.jsonl | 72 | `record_kind` · `model_ref` · `model_version` · `validity_scope` · `scenario_id_ref` · `period` |
| T40 | budget-policies.jsonl | 36 | `policy_id` · `version` · `period` |
| H01 | sales-reports.jsonl | 144 | `report_kind` · `subject_ref` · `period` · `metric_definition_refs` · `reconciliation` |
