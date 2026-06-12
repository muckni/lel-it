-- Idempotent local/demo seed for the Lessons v2 product experience.
-- Targets the newest active project and the local dev user when available.

DO $$
DECLARE
  target_project_id uuid;
  actor_id uuid;
  cat_engineering uuid;
  cat_procurement uuid;
  cat_construction uuid;
  cat_installation uuid;
  cat_commissioning uuid;
  cat_hse uuid;
  cat_commercial uuid;
  cat_pm uuid;
  cat_quality uuid;
  ws_engineering uuid;
  ws_supply_chain uuid;
  ws_construction uuid;
  ws_marine uuid;
  ws_commissioning uuid;
  gate_feed uuid;
  gate_procurement uuid;
  gate_installation uuid;
  gate_takeover uuid;
  cluster_foundation uuid;
  cluster_cables uuid;
  cluster_hse uuid;
  cluster_commissioning uuid;
BEGIN
  SELECT id INTO target_project_id
  FROM projects
  WHERE status = 'active'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO actor_id
  FROM auth.users
  ORDER BY CASE WHEN email = 'admin@user.com' THEN 0 ELSE 1 END, created_at DESC
  LIMIT 1;

  IF target_project_id IS NULL THEN
    RAISE EXCEPTION 'No active project exists. Create a project before running the lessons v2 demo seed.';
  END IF;
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'No auth user exists. Create or seed a local auth user before running this seed.';
  END IF;

  INSERT INTO user_corporate_roles (user_id, role, assigned_by_id)
  VALUES (actor_id, 'corporate_ll_manager', actor_id)
  ON CONFLICT (user_id) DO UPDATE
  SET role = excluded.role, assigned_by_id = excluded.assigned_by_id, updated_at = now();

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (target_project_id, actor_id, 'admin')
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'admin';

  INSERT INTO lesson_project_memberships (project_id, user_id, role, can_export, created_by_id)
  VALUES (target_project_id, actor_id, 'll_lead', true, actor_id)
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = excluded.role, can_export = true, updated_at = now();

  INSERT INTO lesson_categories (name, sort_order)
  VALUES
    ('Engineering', 10),
    ('Procurement', 20),
    ('Construction', 30),
    ('Installation', 40),
    ('Commissioning', 50),
    ('HSE', 60),
    ('Commercial', 70),
    ('Project Management', 80),
    ('Quality', 90),
    ('Other', 100)
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO cat_engineering FROM lesson_categories WHERE name = 'Engineering';
  SELECT id INTO cat_procurement FROM lesson_categories WHERE name = 'Procurement';
  SELECT id INTO cat_construction FROM lesson_categories WHERE name = 'Construction';
  SELECT id INTO cat_installation FROM lesson_categories WHERE name = 'Installation';
  SELECT id INTO cat_commissioning FROM lesson_categories WHERE name = 'Commissioning';
  SELECT id INTO cat_hse FROM lesson_categories WHERE name = 'HSE';
  SELECT id INTO cat_commercial FROM lesson_categories WHERE name = 'Commercial';
  SELECT id INTO cat_pm FROM lesson_categories WHERE name = 'Project Management';
  SELECT id INTO cat_quality FROM lesson_categories WHERE name = 'Quality';

  INSERT INTO lesson_workstreams (project_id, name)
  VALUES
    (target_project_id, 'Foundation & Secondary Steel'),
    (target_project_id, 'Array and Export Cables'),
    (target_project_id, 'Offshore Substation'),
    (target_project_id, 'Marine Operations'),
    (target_project_id, 'Commissioning & Handover'),
    (target_project_id, 'Procurement and Contracts')
  ON CONFLICT (project_id, name) DO NOTHING;

  SELECT id INTO ws_engineering FROM lesson_workstreams WHERE project_id = target_project_id AND name = 'Foundation & Secondary Steel';
  SELECT id INTO ws_supply_chain FROM lesson_workstreams WHERE project_id = target_project_id AND name = 'Procurement and Contracts';
  SELECT id INTO ws_construction FROM lesson_workstreams WHERE project_id = target_project_id AND name = 'Offshore Substation';
  SELECT id INTO ws_marine FROM lesson_workstreams WHERE project_id = target_project_id AND name = 'Marine Operations';
  SELECT id INTO ws_commissioning FROM lesson_workstreams WHERE project_id = target_project_id AND name = 'Commissioning & Handover';

  INSERT INTO lesson_gates (project_id, name, planned_date)
  VALUES
    (target_project_id, 'FEED Freeze', current_date + 30),
    (target_project_id, 'Procurement Gate', current_date + 75),
    (target_project_id, 'Offshore Installation Readiness', current_date + 150),
    (target_project_id, 'Takeover Readiness', current_date + 240)
  ON CONFLICT (project_id, name) DO NOTHING;

  SELECT id INTO gate_feed FROM lesson_gates WHERE project_id = target_project_id AND name = 'FEED Freeze';
  SELECT id INTO gate_procurement FROM lesson_gates WHERE project_id = target_project_id AND name = 'Procurement Gate';
  SELECT id INTO gate_installation FROM lesson_gates WHERE project_id = target_project_id AND name = 'Offshore Installation Readiness';
  SELECT id INTO gate_takeover FROM lesson_gates WHERE project_id = target_project_id AND name = 'Takeover Readiness';

  WITH seed(title, description, type, category_id, workstream_id, package_ref, project_phase, gate_id, impact_level, root_cause, source_org, tags, status, observed_offset) AS (
    VALUES
      ('TP bolt tension records arrived after vessel demobilisation', 'Tensioning evidence was compiled manually and reached the certification team after the installation vessel had left site.', 'problem', cat_quality, ws_engineering, 'FOU/TP', 'installation', gate_installation, 'high', 'Inspection package ownership was split between installation contractor and fabricator.', 'Installation Contractor', ARRAY['qa','foundation','handover'], 'validated', -96),
      ('Early monopile grout mock-up reduced repair work offshore', 'A yard mock-up exposed grout hose routing issues before the first offshore campaign.', 'success', cat_construction, ws_engineering, 'FOU', 'fabrication', gate_installation, 'medium', 'Constructability review included installation technicians earlier than usual.', 'Foundation Fabricator', ARRAY['mock-up','constructability'], 'validated', -94),
      ('Array cable pull-in contingency kit was underspecified', 'The spare sheave and messenger line package did not cover two turbine positions with higher friction.', 'problem', cat_installation, ws_marine, 'IAC', 'installation', gate_installation, 'high', 'Site-specific pull-in analysis was not translated into the marine spread checklist.', 'Cable Contractor', ARRAY['array-cable','marine','spares'], 'validated', -92),
      ('OSS HVAC vendor data freeze prevented late layout churn', 'A single dated vendor data freeze allowed electrical, HVAC, and structural teams to close clashes before fabrication release.', 'success', cat_engineering, ws_construction, 'OSS', 'detailed_design', gate_feed, 'medium', 'Design authority made one team accountable for freeze exceptions.', 'EPCI Contractor', ARRAY['oss','design-freeze'], 'validated', -90),
      ('Metocean assumption change missed procurement package', 'Updated limiting sea-state assumptions reached marine planning but not the jack-up tender package.', 'risk', cat_procurement, ws_supply_chain, 'T&I', 'procurement', gate_procurement, 'high', 'Assumption register was not linked to procurement clarification process.', 'Employer', ARRAY['metocean','procurement','marine'], 'submitted', -88),
      ('Cable protection system tests did not include clay transition', 'CPS qualification used sand conditions only, while the route crosses a clay transition near KP18.', 'problem', cat_engineering, ws_marine, 'IAC', 'detailed_design', gate_feed, 'high', 'Geotechnical envelope was simplified during supplier qualification.', 'Cable Supplier', ARRAY['cps','geotech','qualification'], 'under_review', -86),
      ('Daily SIMOPS board improved commissioning handover', 'A visual SIMOPS board made energisation boundaries clear for mechanical completion and commissioning teams.', 'success', cat_commissioning, ws_commissioning, 'COM', 'commissioning', gate_takeover, 'medium', 'Single source of truth was available in the morning coordination meeting.', 'Commissioning Team', ARRAY['simops','handover'], 'validated', -84),
      ('Lifting accessory certificates were scattered across vendors', 'Third-party certificates were stored in multiple vendor portals and delayed readiness review.', 'problem', cat_quality, ws_supply_chain, 'LOG', 'procurement', gate_procurement, 'medium', 'Document deliverable matrix did not classify lifting accessories as safety critical.', 'Marine Contractor', ARRAY['certificates','lifting','readiness'], 'validated', -82),
      ('HSE walkdown found inconsistent escape signage on TP decks', 'Signage followed vendor templates rather than the project emergency response standard.', 'problem', cat_hse, ws_engineering, 'FOU/TP', 'fabrication', gate_installation, 'medium', 'Emergency response requirements were issued after secondary steel drawings were approved.', 'HSE Team', ARRAY['hse','secondary-steel','signage'], 'validated', -80),
      ('Early customs broker engagement avoided cable drum hold', 'Customs documentation for oversized cable drums was reviewed before port arrival and avoided detention costs.', 'success', cat_commercial, ws_supply_chain, 'IAC', 'procurement', gate_procurement, 'medium', 'Logistics risk review included customs broker and port authority.', 'Logistics Contractor', ARRAY['logistics','customs'], 'validated', -78),
      ('SCADA tag naming standard was approved too late', 'Turbine, OSS, and grid SCADA tags used different naming conventions until commissioning scripts were already drafted.', 'problem', cat_commissioning, ws_commissioning, 'SCADA', 'commissioning', gate_takeover, 'high', 'Controls standard was owned outside the commissioning readiness forum.', 'OEM', ARRAY['scada','controls','commissioning'], 'under_review', -76),
      ('UXO clearance evidence format enabled rapid route release', 'The survey contractor delivered GIS layers and exception logs in the format requested by route engineering.', 'success', cat_engineering, ws_marine, 'Export Cable', 'installation', gate_installation, 'medium', 'Data format was specified in the survey scope and rehearsed in a pilot area.', 'Survey Contractor', ARRAY['uxo','route','gis'], 'validated', -74),
      ('Temporary power load list missed dehumidification demand', 'OSS preservation heaters and dehumidifiers exceeded the temporary power allowance during winter storage.', 'problem', cat_construction, ws_construction, 'OSS', 'fabrication', gate_installation, 'medium', 'Preservation loads were not included in construction utilities planning.', 'OSS Fabricator', ARRAY['temporary-power','preservation'], 'validated', -72),
      ('Port laydown zoning reduced blade handling near misses', 'Dedicated blade and tower transition zones eliminated cross-traffic during peak loadout weeks.', 'success', cat_hse, ws_marine, 'WTG', 'installation', gate_installation, 'high', 'Port layout rehearsal included lifting supervisors and transport contractor.', 'Port Operator', ARRAY['port','hse','loadout'], 'validated', -70),
      ('Grid code interpretation changed after protection settings', 'Protection settings were drafted before the TSO confirmed reactive power interpretation at low load.', 'risk', cat_engineering, ws_commissioning, 'Grid', 'commissioning', gate_takeover, 'high', 'Grid-code clarification owner was not tied to protection setting approval.', 'TSO', ARRAY['grid-code','protection'], 'submitted', -68),
      ('Supplier NCR taxonomy improved trend reviews', 'A shared NCR taxonomy made recurring coating, bolting, and welding issues visible across packages.', 'improvement', cat_quality, ws_supply_chain, 'All Packages', 'fabrication', gate_procurement, 'medium', 'Quality team mapped supplier NCR codes before quarterly review.', 'Quality Team', ARRAY['ncr','quality','taxonomy'], 'validated', -66),
      ('CTV transfer assumptions were not aligned with fatigue plan', 'Technician transfer frequency exceeded the fatigue management assumptions during cable termination weeks.', 'problem', cat_hse, ws_marine, 'IAC', 'installation', gate_installation, 'high', 'Offshore resource plan changed without HSE fatigue review.', 'Marine Coordination', ARRAY['ctv','fatigue','hse'], 'under_review', -64),
      ('Foundation survey acceptance criteria lacked tolerance bands', 'As-built survey data was complete but reviewers disagreed on acceptable tilt and elevation tolerances.', 'problem', cat_engineering, ws_engineering, 'FOU', 'installation', gate_installation, 'medium', 'Acceptance criteria were described in prose rather than measurable bands.', 'Employer Engineer', ARRAY['survey','acceptance'], 'validated', -62),
      ('Packaging trial prevented corrosion on tower internals', 'A pre-shipment packaging trial identified condensation risk and led to improved desiccant placement.', 'success', cat_procurement, ws_supply_chain, 'WTG', 'procurement', gate_procurement, 'medium', 'Supplier quality plan included representative transport duration.', 'WTG OEM', ARRAY['packaging','corrosion','tower'], 'validated', -60),
      ('Offshore fuel bunkering window conflicted with noise curfew', 'Fuel transfer planning did not include local port curfew constraints and delayed vessel turnaround.', 'problem', cat_installation, ws_marine, 'Marine Spread', 'installation', gate_installation, 'medium', 'Port constraints were not included in the marine logistics lookahead.', 'Marine Contractor', ARRAY['fuel','port','schedule'], 'validated', -58),
      ('Change board cadence caught late cable route reroute', 'A twice-weekly technical change board detected knock-on effects of a route change before procurement release.', 'success', cat_pm, ws_marine, 'Export Cable', 'detailed_design', gate_feed, 'high', 'Decision cadence matched the pace of route engineering changes.', 'Project Controls', ARRAY['change-control','route'], 'validated', -56),
      ('Fire damper access panels were blocked by cable trays', 'The OSS model showed access panels clear, but the fabrication sequence installed cable trays before HVAC inspection.', 'problem', cat_construction, ws_construction, 'OSS', 'fabrication', gate_installation, 'medium', 'Model review did not include installation sequence constraints.', 'OSS Fabricator', ARRAY['oss','access','sequence'], 'under_review', -54),
      ('Weather downtime coding improved claims assessment', 'Standard downtime codes made it easier to separate compensable events from contractor productivity losses.', 'improvement', cat_commercial, ws_marine, 'T&I', 'installation', gate_installation, 'high', 'Commercial team aligned coding with marine coordination daily reports.', 'Commercial Team', ARRAY['claims','weather','downtime'], 'validated', -52),
      ('Cable burial risk register lacked landfall ownership', 'Landfall burial risks sat between offshore cable and onshore civil scopes and were not actively mitigated.', 'risk', cat_pm, ws_marine, 'Landfall', 'detailed_design', gate_feed, 'high', 'Boundary ownership was unclear in the package risk register.', 'Employer', ARRAY['landfall','risk','ownership'], 'submitted', -50),
      ('Commissioning punch filters reduced duplicate defects', 'Punch list triage using system, subsystem, and energisation boundary reduced duplicate defect creation.', 'improvement', cat_commissioning, ws_commissioning, 'COM', 'commissioning', gate_takeover, 'medium', 'Commissioning team introduced structured defect filters before energisation.', 'Commissioning Team', ARRAY['punch','defects'], 'validated', -48),
      ('Cable jointing habitat controls arrived after method approval', 'Environmental controls for intertidal jointing were added after the method statement had already been approved.', 'process_deviation', cat_hse, ws_marine, 'Export Cable', 'installation', gate_installation, 'medium', 'Environmental consent conditions were not embedded in method approval checklist.', 'Environmental Advisor', ARRAY['environment','method-statement'], 'validated', -46),
      ('Factory witness points were overbooked in same week', 'Employer and certification witness points across three suppliers exceeded available specialist capacity.', 'problem', cat_quality, ws_supply_chain, 'WTG/OSS/IAC', 'fabrication', gate_procurement, 'medium', 'Integrated inspection calendar was not resource-loaded.', 'Quality Team', ARRAY['inspection','resource'], 'validated', -44),
      ('Spare fiber allocation enabled fast SCADA recovery', 'Reserved fiber pairs allowed commissioning to bypass a damaged patch without waiting for cable repair.', 'success', cat_commissioning, ws_commissioning, 'SCADA', 'commissioning', gate_takeover, 'high', 'Communications design included protected commissioning contingency.', 'SCADA Supplier', ARRAY['fiber','scada','contingency'], 'validated', -42),
      ('Crane pad bearing data was not revalidated after rain', 'Heavy rainfall changed ground conditions but the crane pad bearing check was not refreshed before lift day.', 'risk', cat_hse, ws_construction, 'Onshore Substation', 'installation', gate_installation, 'high', 'Weather-triggered revalidation criterion was missing from lift plan.', 'Civil Contractor', ARRAY['lifting','ground','hse'], 'under_review', -40),
      ('Early O&M spares workshop reduced handover disputes', 'O&M reviewed strategic spares before procurement closeout and clarified responsibility for long-lead components.', 'success', cat_procurement, ws_commissioning, 'O&M', 'procurement', gate_procurement, 'medium', 'O&M was represented in procurement closeout rather than only takeover.', 'O&M Team', ARRAY['spares','handover','om'], 'validated', -38),
      ('Export cable pull head drawings missed coating protection', 'Pull head drawings did not show temporary coating protection required for beach transition handling.', 'problem', cat_engineering, ws_marine, 'Export Cable', 'detailed_design', gate_feed, 'medium', 'Temporary works detail was separated from permanent design package.', 'Cable Engineer', ARRAY['export-cable','temporary-works'], 'validated', -36),
      ('Permit-to-work boundaries were too broad for energisation', 'PTW zones covered multiple subsystems and slowed fault response during first energisation.', 'problem', cat_commissioning, ws_commissioning, 'COM', 'commissioning', gate_takeover, 'high', 'Energisation boundary definitions were not aligned with PTW templates.', 'Commissioning Manager', ARRAY['ptw','energisation'], 'validated', -34),
      ('Supplier document sprints cleared overdue critical docs', 'Two-week supplier document sprints with named reviewers cleared most overdue critical documents.', 'improvement', cat_pm, ws_supply_chain, 'All Packages', 'procurement', gate_procurement, 'medium', 'Document control switched from passive reminders to sprint ownership.', 'Document Control', ARRAY['documents','supplier'], 'validated', -32),
      ('Turbine access ladder coating repair repeated across lots', 'Three tower lots repeated the same coating defect around ladder brackets.', 'problem', cat_quality, ws_supply_chain, 'WTG', 'fabrication', gate_procurement, 'medium', 'Corrective action was approved for one lot but not rolled into supplier work instruction.', 'WTG OEM', ARRAY['coating','tower','repeat-defect'], 'validated', -30),
      ('Jack-up punch items were not closed before transit', 'Minor deck equipment punch items remained open and created offshore productivity loss.', 'process_deviation', cat_installation, ws_marine, 'T&I', 'installation', gate_installation, 'medium', 'Vessel readiness checklist allowed non-critical items without owner/date.', 'Marine Contractor', ARRAY['vessel-readiness','punch'], 'submitted', -28),
      ('Integrated risk burndown made gate readiness visible', 'A gate readiness burndown showed unresolved high risks by package and focused management attention.', 'success', cat_pm, ws_supply_chain, 'All Packages', 'procurement', gate_procurement, 'high', 'Risk review format connected gate criteria to accountable workstreams.', 'PMO', ARRAY['gate','risk','pmo'], 'validated', -26),
      ('Cable termination tooling calibration was near expiry', 'Two termination tool kits arrived offshore with calibration expiring during planned works.', 'risk', cat_quality, ws_marine, 'IAC', 'installation', gate_installation, 'medium', 'Tool calibration expiry was checked at mobilisation but not against execution window.', 'Cable Contractor', ARRAY['tooling','calibration'], 'under_review', -24),
      ('Landowner access windows were not reflected in schedule', 'Onshore export cable access restrictions were managed in permits but not in the integrated schedule.', 'problem', cat_pm, ws_supply_chain, 'Onshore Cable', 'installation', gate_installation, 'medium', 'Permit constraints were not converted into schedule calendars.', 'Onshore Contractor', ARRAY['schedule','permits','landowner'], 'validated', -22),
      ('Shared lessons huddle caught repeat NCR early', 'A short weekly lessons huddle identified a repeated weld documentation error before the next lot release.', 'success', cat_quality, ws_engineering, 'FOU', 'fabrication', gate_procurement, 'medium', 'Lessons review was embedded into production release meeting.', 'Quality Team', ARRAY['lessons-huddle','welding'], 'validated', -20),
      ('Cybersecurity evidence was not mapped to takeover checklist', 'Cybersecurity test evidence existed but was not referenced in the takeover readiness pack.', 'problem', cat_commissioning, ws_commissioning, 'SCADA', 'commissioning', gate_takeover, 'high', 'Cyber deliverables were not mapped to operational acceptance criteria.', 'SCADA Supplier', ARRAY['cyber','takeover','evidence'], 'submitted', -18),
      ('Marine mammal observation standby rules reduced ambiguity', 'Clear standby rules for MMO observations avoided conflicting instructions during piling weather holds.', 'success', cat_hse, ws_marine, 'FOU', 'installation', gate_installation, 'medium', 'Environmental controls were translated into operational decision rules.', 'Environmental Advisor', ARRAY['environment','piling','mmo'], 'validated', -16),
      ('Procurement deviations lacked lifecycle owner', 'Approved procurement deviations were not assigned to owners for verification during fabrication.', 'process_deviation', cat_procurement, ws_supply_chain, 'All Packages', 'procurement', gate_procurement, 'medium', 'Deviation approval workflow ended before implementation verification.', 'Procurement Team', ARRAY['deviation','verification'], 'validated', -14),
      ('OSS black-start rehearsal exposed radio coverage gap', 'The black-start tabletop rehearsal revealed a radio coverage gap between control room and emergency generator area.', 'risk', cat_commissioning, ws_construction, 'OSS', 'commissioning', gate_takeover, 'high', 'Emergency communications were not tested in scenario rehearsal.', 'OSS Commissioning', ARRAY['black-start','radio','emergency'], 'under_review', -12),
      ('Package-level action owners accelerated closeout', 'Assigning lesson actions to package owners with dates improved closure before gate review.', 'improvement', cat_pm, ws_commissioning, 'All Packages', 'commissioning', gate_takeover, 'medium', 'Action ownership was visible in the project dashboard.', 'PMO', ARRAY['action-tracking','gate-review'], 'validated', -10),
      ('Supplier translation quality affected installation manuals', 'Translated installation manuals used inconsistent torque terminology and required clarification offshore.', 'problem', cat_procurement, ws_supply_chain, 'WTG', 'installation', gate_installation, 'medium', 'Technical translation review was not included in document acceptance.', 'WTG OEM', ARRAY['manuals','translation','torque'], 'submitted', -8),
      ('Cable route lessons were reused in export cable package', 'Array cable route-change lessons were applied to export cable risk workshops and reduced late clarifications.', 'success', cat_engineering, ws_marine, 'Export Cable', 'detailed_design', gate_feed, 'medium', 'Cross-package lessons were reviewed before route risk workshop.', 'Engineering Team', ARRAY['reuse','route','workshop'], 'validated', -6),
      ('Late permit evidence blocked sectional completion claim', 'The contractor claim package missed permit evidence required for sectional completion acceptance.', 'problem', cat_commercial, ws_supply_chain, 'Onshore Cable', 'installation', gate_takeover, 'medium', 'Commercial acceptance checklist did not reference permit evidence.', 'Commercial Team', ARRAY['claim','permit','acceptance'], 'draft', -4)
  )
  INSERT INTO lessons_v2 (
    project_id, title, description, type, category_id, author_id, observed_date,
    workstream_id, package_ref, project_phase, gate_id, impact_level, root_cause,
    source_organisation, tags, confidentiality_level, status, validated_by_id, validated_at,
    created_at, updated_at
  )
  SELECT
    target_project_id, title, description, type::ll_type, category_id, actor_id,
    (current_date + observed_offset)::date, workstream_id, package_ref, project_phase::project_phase,
    gate_id, impact_level, root_cause, source_org, tags, 'internal'::confidentiality_level,
    status::lesson_v2_status,
    CASE WHEN status = 'validated' THEN actor_id ELSE NULL END,
    CASE WHEN status = 'validated' THEN now() + (observed_offset || ' days')::interval ELSE NULL END,
    now() + (observed_offset || ' days')::interval,
    now() + (observed_offset || ' days')::interval
  FROM seed s
  WHERE NOT EXISTS (
    SELECT 1 FROM lessons_v2 l
    WHERE l.project_id = target_project_id AND l.title = s.title
  );

  WITH cluster_seed(name, summary, workstream_id, project_phase, root_cause, impact_summary, impact_cost_eur, impact_schedule_days, approved_offset) AS (
    VALUES
      ('Foundation quality evidence and acceptance', 'Repeated foundation handover lessons show that acceptance bands, certificates, and evidence ownership must be fixed before offshore execution.', ws_engineering, 'installation', 'Evidence ownership and measurable acceptance criteria were not consistently embedded in readiness reviews.', 'Avoids offshore remobilisation and certification delay.', 450000, 18, -18),
      ('Cable installation readiness controls', 'Cable pull-in, CPS, tooling, and route-change lessons point to missing translation between engineering assumptions and marine readiness packs.', ws_marine, 'installation', 'Engineering assumptions did not flow into marine spread checklists.', 'Reduces cable campaign standby and rework.', 650000, 22, -16),
      ('HSE and environmental decision rules', 'HSE, fatigue, environmental, and lifting lessons need operational decision rules instead of generic method statements.', ws_marine, 'installation', 'Control requirements were written but not converted into field decision rules.', 'Improves offshore execution safety and permit compliance.', 250000, 8, -12),
      ('Commissioning evidence and energisation boundaries', 'SCADA, PTW, cybersecurity, and takeover lessons show the need for earlier system-boundary governance.', ws_commissioning, 'commissioning', 'Commissioning evidence and boundaries were not mapped early enough to takeover criteria.', 'Reduces energisation delays and duplicate defects.', 520000, 15, -9)
  )
  INSERT INTO lesson_clusters_v2 (
    project_id, name, summary, status, workstream_id, project_phase, root_cause, impact_summary,
    impact_cost_eur, impact_schedule_days, created_by_id, approved_by_id, approved_at
  )
  SELECT
    target_project_id, name, summary, 'approved'::lesson_cluster_status, workstream_id,
    project_phase::project_phase, root_cause, impact_summary, impact_cost_eur, impact_schedule_days,
    actor_id, actor_id, now() + (approved_offset || ' days')::interval
  FROM cluster_seed cs
  WHERE NOT EXISTS (
    SELECT 1 FROM lesson_clusters_v2 lc
    WHERE lc.project_id = target_project_id AND lc.name = cs.name
  );

  SELECT id INTO cluster_foundation FROM lesson_clusters_v2 WHERE project_id = target_project_id AND name = 'Foundation quality evidence and acceptance';
  SELECT id INTO cluster_cables FROM lesson_clusters_v2 WHERE project_id = target_project_id AND name = 'Cable installation readiness controls';
  SELECT id INTO cluster_hse FROM lesson_clusters_v2 WHERE project_id = target_project_id AND name = 'HSE and environmental decision rules';
  SELECT id INTO cluster_commissioning FROM lesson_clusters_v2 WHERE project_id = target_project_id AND name = 'Commissioning evidence and energisation boundaries';

  INSERT INTO lesson_cluster_links_v2 (cluster_id, lesson_id, added_by_id)
  SELECT cluster_foundation, id, actor_id FROM lessons_v2
  WHERE project_id = target_project_id AND status = 'validated' AND (title ILIKE '%foundation%' OR title ILIKE '%TP%' OR title ILIKE '%tower%')
  ON CONFLICT (cluster_id, lesson_id) DO NOTHING;

  INSERT INTO lesson_cluster_links_v2 (cluster_id, lesson_id, added_by_id)
  SELECT cluster_cables, id, actor_id FROM lessons_v2
  WHERE project_id = target_project_id AND status = 'validated' AND (title ILIKE '%cable%' OR title ILIKE '%route%' OR title ILIKE '%landfall%')
  ON CONFLICT (cluster_id, lesson_id) DO NOTHING;

  INSERT INTO lesson_cluster_links_v2 (cluster_id, lesson_id, added_by_id)
  SELECT cluster_hse, id, actor_id FROM lessons_v2
  WHERE project_id = target_project_id AND status = 'validated' AND (title ILIKE '%HSE%' OR title ILIKE '%environment%' OR title ILIKE '%fatigue%' OR title ILIKE '%MMO%')
  ON CONFLICT (cluster_id, lesson_id) DO NOTHING;

  INSERT INTO lesson_cluster_links_v2 (cluster_id, lesson_id, added_by_id)
  SELECT cluster_commissioning, id, actor_id FROM lessons_v2
  WHERE project_id = target_project_id AND status = 'validated' AND (title ILIKE '%commissioning%' OR title ILIKE '%SCADA%' OR title ILIKE '%PTW%' OR title ILIKE '%cyber%')
  ON CONFLICT (cluster_id, lesson_id) DO NOTHING;

  WITH action_seed(title, description, guidance, category_id, cluster_id, reuse, status, tags) AS (
    VALUES
      ('Define evidence owners in every readiness pack', 'Every safety or quality critical evidence item must have an accountable owner, due date, and acceptance reviewer before mobilisation.', 'Add an evidence-owner column to readiness templates and block gate approval when owner/date are missing.', cat_quality, cluster_foundation, 'universally_applicable', 'corporate_approved', ARRAY['evidence','readiness','quality']),
      ('Translate engineering assumptions into marine checklists', 'Metocean, geotechnical, pull-in, and tooling assumptions must be converted into vessel readiness and spares checklists.', 'Hold a joint engineering/marine checklist review two weeks before vessel mobilisation.', cat_installation, cluster_cables, 'universally_applicable', 'corporate_approved', ARRAY['marine','checklist','assumptions']),
      ('Create operational decision rules for HSE controls', 'Environmental and HSE controls must be converted into simple go/no-go or standby decision rules for offshore supervisors.', 'Attach decision rules to method statements and brief them at daily coordination meetings.', cat_hse, cluster_hse, 'reusable_with_adaptation', 'proposed_for_corporate', ARRAY['hse','decision-rules']),
      ('Map commissioning evidence to takeover criteria early', 'Commissioning, cybersecurity, SCADA, and PTW evidence must be mapped to takeover criteria before energisation.', 'Maintain a system-boundary evidence matrix from commissioning planning through handover.', cat_commissioning, cluster_commissioning, 'universally_applicable', 'corporate_approved', ARRAY['commissioning','takeover','evidence']),
      ('Run supplier document sprints before gate reviews', 'Critical overdue supplier documents should be cleared through short sprints with named reviewers and daily blockers.', 'Use a two-week sprint board for overdue critical documents ahead of procurement and installation gates.', cat_pm, NULL, 'reusable_with_adaptation', 'project_approved', ARRAY['documents','supplier','gate']),
      ('Resource-load inspection and witness calendars', 'Inspection plans must be checked against actual employer, certifier, and specialist availability.', 'Create an integrated witness-point calendar and review conflicts in the weekly quality meeting.', cat_quality, NULL, 'reusable_with_adaptation', 'corporate_approved', ARRAY['inspection','resource']),
      ('Include customs and port constraints in logistics readiness', 'Customs broker, port authority, and local operating constraints should be reviewed before heavy component arrival.', 'Add a port/customs readiness line item to the logistics risk review.', cat_commercial, NULL, 'reusable_with_adaptation', 'project_approved', ARRAY['logistics','customs','port']),
      ('Protect strategic commissioning contingencies', 'Critical communications and temporary systems need explicit contingency capacity for early commissioning faults.', 'Reserve spare communications capacity and verify bypass options during commissioning planning.', cat_commissioning, NULL, 'reusable_with_adaptation', 'corporate_approved', ARRAY['contingency','scada']),
      ('Convert permit constraints into schedule calendars', 'Permit and landowner access constraints must be reflected as calendars or hard constraints in the integrated schedule.', 'Require planning sign-off that permit windows are coded into the schedule before baseline approval.', cat_pm, NULL, 'universally_applicable', 'proposed_for_corporate', ARRAY['schedule','permits']),
      ('Verify approved deviations through implementation', 'Procurement and technical deviations should remain open until implementation evidence is verified.', 'Assign each approved deviation to an implementation owner and close only after evidence review.', cat_procurement, NULL, 'universally_applicable', 'corporate_approved', ARRAY['deviation','verification']),
      ('Run cross-package lessons huddles before release gates', 'Recurring supplier and package issues should be reviewed in short cross-package lessons huddles before lot release.', 'Schedule a 30-minute weekly lessons huddle during fabrication peaks.', cat_quality, NULL, 'reusable_with_adaptation', 'project_approved', ARRAY['lessons-huddle','fabrication']),
      ('Review technical translations before offshore issue', 'Translated manuals and procedures must be technically reviewed before release to offshore teams.', 'Add technical translation approval to document acceptance for installation-critical manuals.', cat_procurement, NULL, 'reusable_with_adaptation', 'proposed_for_corporate', ARRAY['manuals','translation'])
  )
  INSERT INTO recommended_actions (
    project_id, title, action_description, implementation_guidance, category_id, source_cluster_id,
    reusability_level, confidentiality_level, status, is_corporate_candidate, transfer_checklist,
    transfer_proposed_by_id, transfer_proposed_at, corporate_review_by_id, corporate_reviewed_at,
    created_by_id, approved_by_id, approved_at, tags
  )
  SELECT
    target_project_id, title, description, guidance, category_id, cluster_id,
    reuse::reusability_level, 'internal'::confidentiality_level, status::recommended_action_status,
    status IN ('proposed_for_corporate','corporate_approved'),
    CASE WHEN status IN ('proposed_for_corporate','corporate_approved')
      THEN '{"noPersonalData":true,"commerciallyShareable":true,"sourceApproved":true,"implementationContextCaptured":true}'::jsonb
      ELSE NULL
    END,
    CASE WHEN status IN ('proposed_for_corporate','corporate_approved') THEN actor_id ELSE NULL END,
    CASE WHEN status IN ('proposed_for_corporate','corporate_approved') THEN now() - interval '6 days' ELSE NULL END,
    CASE WHEN status = 'corporate_approved' THEN actor_id ELSE NULL END,
    CASE WHEN status = 'corporate_approved' THEN now() - interval '3 days' ELSE NULL END,
    actor_id, actor_id, now() - interval '7 days', tags
  FROM action_seed s
  WHERE NOT EXISTS (
    SELECT 1 FROM recommended_actions ra
    WHERE ra.project_id = target_project_id AND ra.title = s.title
  );

  WITH approved AS (
    SELECT ra.*
    FROM recommended_actions ra
    WHERE ra.project_id = target_project_id
      AND ra.status = 'corporate_approved'
      AND NOT EXISTS (
        SELECT 1 FROM corporate_recommended_actions cra
        WHERE cra.source_recommended_action_id = ra.id
      )
    LIMIT 8
  ),
  inserted AS (
    INSERT INTO corporate_recommended_actions (
      title, action_description, implementation_guidance, category_id, status, reusability_level,
      applicable_phases, applicable_workstreams, tags, source_recommended_action_id, source_project_id,
      origin_summary, published_by_id, published_at
    )
    SELECT
      title, action_description, implementation_guidance, category_id, 'active'::corporate_action_status,
      reusability_level,
      ARRAY['procurement','fabrication','installation','commissioning']::project_phase[],
      ARRAY['Engineering','Procurement','Marine Operations','Commissioning'],
      tags, id, project_id,
      'Promoted from seeded project lessons after corporate checklist review.',
      actor_id, now() - interval '2 days'
    FROM approved
    RETURNING id, source_recommended_action_id
  )
  UPDATE recommended_actions ra
  SET corporate_action_id = inserted.id, updated_at = now()
  FROM inserted
  WHERE ra.id = inserted.source_recommended_action_id;

  INSERT INTO project_actions (
    project_id, title, action_description, implementation_guidance, category_id, status,
    source_corporate_action_id, source_corporate_action_version, source_recommended_action_id,
    current_owner_id, deadline, created_by_id, tags, verified_by_id, verified_at, closed_by_id, closed_at
  )
  SELECT
    target_project_id,
    cra.title,
    cra.action_description,
    cra.implementation_guidance,
    cra.category_id,
    CASE
      WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 6 = 0 THEN 'closed'
      WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 5 = 0 THEN 'verified'
      WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 4 = 0 THEN 'implemented'
      WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 3 = 0 THEN 'in_progress'
      ELSE 'assigned'
    END::project_action_status,
    cra.id,
    cra.version,
    cra.source_recommended_action_id,
    actor_id,
    (current_date + (14 + row_number() OVER (ORDER BY cra.published_at DESC) * 7)::int)::date,
    actor_id,
    cra.tags,
    CASE WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 5 = 0 THEN actor_id ELSE NULL END,
    CASE WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 5 = 0 THEN now() - interval '1 day' ELSE NULL END,
    CASE WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 6 = 0 THEN actor_id ELSE NULL END,
    CASE WHEN row_number() OVER (ORDER BY cra.published_at DESC) % 6 = 0 THEN now() ELSE NULL END
  FROM corporate_recommended_actions cra
  WHERE cra.source_project_id = target_project_id
    AND NOT EXISTS (
      SELECT 1 FROM project_actions pa
      WHERE pa.project_id = target_project_id AND pa.source_corporate_action_id = cra.id
    );

  INSERT INTO action_assignments (project_action_id, project_id, owner_id, assigned_by_id, deadline_at_assignment)
  SELECT id, project_id, current_owner_id, actor_id, deadline
  FROM project_actions
  WHERE project_id = target_project_id
    AND current_owner_id IS NOT NULL
    AND deadline IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM action_assignments aa WHERE aa.project_action_id = project_actions.id
    );

  RAISE NOTICE 'Seeded Lessons v2 demo data for project % using actor %', target_project_id, actor_id;
END $$;
