import { createClient } from "npm:@supabase/supabase-js@2.57.4";

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase env vars", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();
  const dayStartIso = new Date(new Date().toISOString().slice(0, 10)).toISOString();

  let reminders = 0;

  const shouldInsertNotification = async (
    userId: string,
    type: string,
    referenceType: string,
    referenceId: string
  ) => {
    const { data: existing, error } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .eq("reference_type", referenceType)
      .eq("reference_id", referenceId)
      .gte("created_at", dayStartIso)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("Notification lookup failed", { userId, type, referenceId, error });
      return false;
    }
    return !existing?.id;
  };

  const { data: overdueActions } = await supabase
    .from("lesson_track_a_actions")
    .select("id,project_id,owner_user_id,action_text,status,due_at")
    .lt("due_at", nowIso)
    .neq("status", "done");

  for (const action of overdueActions ?? []) {
    if (!action.owner_user_id) continue;

    await supabase
      .from("lesson_track_a_actions")
      .update({ status: "overdue", updated_at: nowIso })
      .eq("id", action.id);

    const insertAllowed = await shouldInsertNotification(
      action.owner_user_id,
      "lesson_track_a_overdue",
      "lesson_track_a_action",
      action.id
    );
    if (!insertAllowed) continue;

    const { error } = await supabase.from("notifications").insert({
      user_id: action.owner_user_id,
      type: "lesson_track_a_overdue",
      reference_type: "lesson_track_a_action",
      reference_id: action.id,
      message: `Track A action overdue: ${String(action.action_text ?? "").slice(0, 80)}`,
      read: false,
    });

    if (!error) reminders += 1;
  }

  const { data: pendingEscalations } = await supabase
    .from("lesson_track_b_escalations")
    .select("id,project_id,status,due_by")
    .in("status", ["draft", "submitted"])
    .lt("due_by", nowIso);

  for (const escalation of pendingEscalations ?? []) {
    const { data: directors } = await supabase
      .from("project_lesson_role_assignments")
      .select("member:project_members(user_id)")
      .eq("project_id", escalation.project_id)
      .in("role_type", ["pmo_director", "hope"]);

    for (const director of directors ?? []) {
      const userId = (director as any)?.member?.user_id as string | undefined;
      if (!userId) continue;
      const insertAllowed = await shouldInsertNotification(
        userId,
        "lesson_track_b_overdue",
        "lesson_track_b_escalation",
        escalation.id
      );
      if (!insertAllowed) continue;
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "lesson_track_b_overdue",
        reference_type: "lesson_track_b_escalation",
        reference_id: escalation.id,
        message: "Track B escalation submission SLA exceeded.",
        read: false,
      });
      if (!error) reminders += 1;
    }
  }

  return new Response(JSON.stringify({ reminders }), {
    headers: { "Content-Type": "application/json" },
  });
});
