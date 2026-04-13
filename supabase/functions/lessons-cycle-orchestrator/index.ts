import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type PolicyRow = {
  id: string;
  portfolio_id: string;
  monthly_triage_day: number;
  pre_gate_lead_weeks: number;
  active: boolean;
};

type ProjectRow = {
  id: string;
  portfolio_id: string;
  name: string;
};

function toIsoDate(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: policies, error: policyError } = await supabase
    .from("lesson_policy_profiles")
    .select("id,portfolio_id,monthly_triage_day,pre_gate_lead_weeks,active")
    .eq("active", true);

  if (policyError) {
    console.error("Policy read failed", policyError);
    return new Response("Policy read failed", { status: 500 });
  }

  const policyByPortfolio = new Map<string, PolicyRow>();
  for (const row of (policies ?? []) as PolicyRow[]) {
    if (!row.portfolio_id) continue;
    if (!policyByPortfolio.has(row.portfolio_id)) {
      policyByPortfolio.set(row.portfolio_id, row);
    }
  }

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id,portfolio_id,name")
    .eq("status", "active");

  if (projectError) {
    console.error("Project read failed", projectError);
    return new Response("Project read failed", { status: 500 });
  }

  const today = new Date();
  const dayOfMonth = today.getUTCDate();
  const thisMonthLabel = today.toISOString().slice(0, 7);

  let createdCycles = 0;

  for (const project of (projects ?? []) as ProjectRow[]) {
    const policy = policyByPortfolio.get(project.portfolio_id);
    if (!policy) continue;

    const { data: activeCycle } = await supabase
      .from("lesson_cycles")
      .select("id")
      .eq("project_id", project.id)
      .eq("state", "active")
      .limit(1)
      .maybeSingle();

    if (activeCycle?.id) continue;

    if (dayOfMonth < (policy.monthly_triage_day ?? 1)) continue;

    const cycleLabel = `Monthly ${thisMonthLabel}`;

    const { data: existing } = await supabase
      .from("lesson_cycles")
      .select("id")
      .eq("project_id", project.id)
      .eq("cycle_label", cycleLabel)
      .limit(1)
      .maybeSingle();
    if (existing?.id) continue;

    const startsAt = new Date();

    const { error: insertError } = await supabase.from("lesson_cycles").insert({
      project_id: project.id,
      policy_profile_id: policy.id,
      cycle_type: "monthly",
      state: "active",
      cycle_label: cycleLabel,
      starts_at: startsAt.toISOString(),
      created_by: "00000000-0000-0000-0000-000000000000",
    });

    if (insertError) {
      console.error("Cycle insert failed", project.id, insertError);
      continue;
    }

    createdCycles += 1;
  }

  return new Response(
    JSON.stringify({
      date: toIsoDate(today),
      createdCycles,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
