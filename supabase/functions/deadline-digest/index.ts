import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type DeadlineRow = {
  project_id: string;
  entity_type: "interface_point" | "deliverable" | "iq";
  entity_id: string;
  title: string;
  due_date: string;
  entity_status: string | null;
  register_id: string | null;
  agreement_id: string | null;
  point_id: string | null;
  query_id: string | null;
};

function isClosed(entityType: DeadlineRow["entity_type"], status: string | null): boolean {
  if (!status) return false;
  if (entityType === "interface_point") return status === "resolved" || status === "closed";
  if (entityType === "deliverable") return status === "accepted";
  return status === "accepted" || status === "rejected" || status === "closed";
}

function dateOnlyIso(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function urlForItem(appBaseUrl: string, projectId: string, row: DeadlineRow): string {
  if (row.entity_type === "iq" && row.query_id) {
    return `${appBaseUrl}/projects/${projectId}/queries/${row.query_id}`;
  }
  const pointId = row.entity_type === "interface_point" ? row.entity_id : row.point_id;
  if (pointId && row.register_id && row.agreement_id) {
    return `${appBaseUrl}/projects/${projectId}/registers/${row.register_id}/agreements/${row.agreement_id}/points/${pointId}`;
  }
  return `${appBaseUrl}/projects/${projectId}`;
}

function entityLabel(type: DeadlineRow["entity_type"]): string {
  if (type === "interface_point") return "Interface Point";
  if (type === "deliverable") return "Deliverable";
  return "IQ";
}

async function sha256(input: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function buildHtml(projectName: string, items: DeadlineRow[], appBaseUrl: string): string {
  const rows = items
    .map((item) => {
      const url = urlForItem(appBaseUrl, item.project_id, item);
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${entityLabel(item.entity_type)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.title}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${item.due_date}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;"><a href="${url}">Open</a></td>
      </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;color:#111;">
    <h2 style="margin-bottom:8px;">Upcoming Deadlines · ${projectName}</h2>
    <p style="margin-top:0;">Items due within the next 7 days.</p>
    <table style="border-collapse:collapse;width:100%;">
      <thead>
        <tr>
          <th align="left" style="padding:6px 8px;border-bottom:1px solid #ddd;">Type</th>
          <th align="left" style="padding:6px 8px;border-bottom:1px solid #ddd;">Title</th>
          <th align="left" style="padding:6px 8px;border-bottom:1px solid #ddd;">Due Date</th>
          <th align="left" style="padding:6px 8px;border-bottom:1px solid #ddd;">Link</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

Deno.serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const DIGEST_FROM_EMAIL = Deno.env.get("DIGEST_FROM_EMAIL");
  const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "http://localhost:3000";

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response("Missing Supabase env vars", { status: 500 });
  }
  if (!RESEND_API_KEY || !DIGEST_FROM_EMAIL) {
    return new Response("Missing email env vars", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const today = new Date();
  const digestDate = dateOnlyIso(today);
  const endDate = dateOnlyIso(addDays(today, 7));

  const { data: upcomingRaw, error: upcomingError } = await supabase
    .from("project_deadlines_v")
    .select("*")
    .gte("due_date", digestDate)
    .lte("due_date", endDate)
    .order("project_id", { ascending: true })
    .order("due_date", { ascending: true });

  if (upcomingError) {
    console.error("Failed to fetch upcoming deadlines", upcomingError);
    return new Response("Failed to fetch deadlines", { status: 500 });
  }

  const upcoming = (upcomingRaw as DeadlineRow[]).filter(
    (row) => !isClosed(row.entity_type, row.entity_status)
  );

  if (upcoming.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No upcoming deadlines" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectIds = Array.from(new Set(upcoming.map((row) => row.project_id)));
  const { data: projects } = await supabase
    .from("projects")
    .select("id,name")
    .in("id", projectIds);
  const projectNameMap = new Map((projects ?? []).map((p) => [p.id, p.name as string]));

  const { data: members, error: membersError } = await supabase
    .from("project_members")
    .select("project_id,user_id,role")
    .in("project_id", projectIds);
  if (membersError) {
    console.error("Failed to fetch project members", membersError);
    return new Response("Failed to fetch members", { status: 500 });
  }

  const userCache = new Map<string, { email: string | null; name: string | null }>();
  let sentCount = 0;

  for (const projectId of projectIds) {
    const projectItems = upcoming.filter((row) => row.project_id === projectId);
    const projectMembers = (members ?? []).filter((row) => row.project_id === projectId);

    for (const member of projectMembers) {
      if (!userCache.has(member.user_id)) {
        const { data: userResp, error: userErr } = await supabase.auth.admin.getUserById(
          member.user_id
        );
        if (userErr) {
          console.error("Failed to load user", member.user_id, userErr);
          userCache.set(member.user_id, { email: null, name: null });
        } else {
          userCache.set(member.user_id, {
            email: userResp.user?.email ?? null,
            name: (userResp.user?.user_metadata?.full_name as string | undefined) ?? null,
          });
        }
      }

      const user = userCache.get(member.user_id);
      if (!user?.email) continue;

      const contentHash = await sha256(
        JSON.stringify(projectItems.map((item) => [item.entity_type, item.entity_id, item.due_date]))
      );

      const { data: existing } = await supabase
        .from("deadline_digest_sends")
        .select("id")
        .eq("digest_date", digestDate)
        .eq("project_id", projectId)
        .eq("user_id", member.user_id)
        .maybeSingle();
      if (existing?.id) continue;

      const html = buildHtml(
        projectNameMap.get(projectId) ?? "Project",
        projectItems,
        APP_BASE_URL
      );

      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: DIGEST_FROM_EMAIL,
          to: [user.email],
          subject: `Upcoming deadlines (${projectItems.length})`,
          html,
        }),
      });

      if (!emailResp.ok) {
        console.error("Resend send failed", await emailResp.text());
        continue;
      }

      const { error: logError } = await supabase.from("deadline_digest_sends").insert({
        digest_date: digestDate,
        project_id: projectId,
        user_id: member.user_id,
        content_hash: contentHash,
      });

      if (logError) {
        console.error("Failed to log digest send", logError);
        continue;
      }

      sentCount += 1;
    }
  }

  return new Response(JSON.stringify({ sent: sentCount }), {
    headers: { "Content-Type": "application/json" },
  });
});
