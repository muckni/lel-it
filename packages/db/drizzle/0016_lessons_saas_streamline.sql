-- Additive: rich-text body for lessons
ALTER TABLE lessons_v2 ADD COLUMN IF NOT EXISTS content jsonb;

-- Destructive: drop legacy interface-management + v1/intermediate lessons.
-- IRREVERSIBLE. Run only after confirming legacy data is disposable.
DROP TABLE IF EXISTS
  interface_tracker_case_links, interface_tracker_events, interface_tracker_items,
  interface_audit_exports, interface_monthly_reports, interface_meeting_attendance,
  interface_meetings, interface_matrix_packs, interface_matrix_allocations,
  interface_matrix_rows, interface_matrix_revisions, interface_case_events,
  interface_cases, iq_responses, interface_queries, deliverables, interface_points,
  interface_agreements, interface_registers, moc_entity_links, moc_approvals,
  moc_changes, cable_routes, asset_placements, model_registry_assets,
  custom_anchor_definitions, member_work_packages, work_packages, comments,
  lesson_package_reports, lesson_track_b_escalations, lesson_action_evidence,
  lesson_track_a_actions, lesson_cluster_items, lesson_clusters,
  lesson_triage_decisions, lesson_cycles,
  project_lesson_policy_assignments, lesson_policy_profiles,
  lesson_learned_change_requests, lesson_learned_points, lessons_learned
CASCADE;
-- NOTE: project_lesson_role_assignments is intentionally NOT dropped (used by v2 RBAC).

-- Migrate the attachment_entity enum to lesson-only.
ALTER TABLE attachments
  ALTER COLUMN entity_type TYPE text USING entity_type::text;
DELETE FROM attachments WHERE entity_type <> 'lesson';
DROP TYPE IF EXISTS attachment_entity;
CREATE TYPE attachment_entity AS ENUM ('lesson');
ALTER TABLE attachments
  ALTER COLUMN entity_type TYPE attachment_entity USING entity_type::attachment_entity;

-- Drop now-orphaned enum types (CASCADE already removed dependent columns).
-- DEVIATION: the following are intentionally NOT dropped because retained tables
-- still use them:
--   * ll_type                -> lessons_v2.type
--   * lesson_role_type        -> project_lesson_role_assignments.role_type
--   * interface_party_role    -> project_member_organization_roles.interface_role
DROP TYPE IF EXISTS
  agreement_status, asset_type, criticality, deliverable_status, discipline,
  interface_case_event_type, interface_case_state,
  iq_response_status, matrix_phase_column, moc_approval_decision, moc_approval_level,
  moc_implementation_status, moc_status, point_status, query_priority, query_status,
  register_status, scope_allocation_mode, tracker_item_status,
  ll_change_request_status, ll_discipline, ll_ownership_state, ll_status,
  lesson_cycle_state, lesson_cycle_type, lesson_escalation_status,
  lesson_triage_decision, lesson_workflow_state, lesson_action_priority,
  lesson_action_status;
