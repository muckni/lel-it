"use client";

import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ListIcon, MessageSquareIcon, CheckSquareIcon, AlertTriangleIcon } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "#F59E0B",
  in_progress: "#3B82F6",
  resolved: "#10B981",
  closed: "#9CA3AF",
  responded: "#6366F1",
  accepted: "#10B981",
  rejected: "#EF4444",
  not_started: "#9CA3AF",
  submitted: "#F59E0B",
};

const CRITICALITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  major: "#F97316",
  minor: "#6B7280",
};

function StatCard({
  title,
  value,
  icon,
  sub,
  color = "text-foreground",
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className="p-2.5 rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.report.projectSummary.queryOptions({ projectId })
  );

  if (isLoading || !data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading reports…</div>
    );
  }

  const { pointsByStatus, pointsByCriticality, iqsByStatus, deliverablesByStatus, packagePairMatrix, totals } = data;

  // Package pair bar chart data
  const pairChartData = packagePairMatrix
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((p) => ({
      name: `${p.packageA.code}↔${p.packageB.code}`,
      points: p.count,
      fill: p.packageA.color,
    }));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Project interface status overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Interface Points"
          value={totals.points}
          icon={<ListIcon className="h-5 w-5 text-muted-foreground" />}
          sub={`${pointsByStatus.find((s: any) => s.status === "resolved")?.count ?? 0} resolved`}
        />
        <StatCard
          title="Interface Queries"
          value={totals.iqs}
          icon={<MessageSquareIcon className="h-5 w-5 text-muted-foreground" />}
          sub={`${totals.openIqs} open`}
          color={totals.openIqs > 0 ? "text-amber-600" : "text-foreground"}
        />
        <StatCard
          title="Deliverables"
          value={totals.deliverables}
          icon={<CheckSquareIcon className="h-5 w-5 text-muted-foreground" />}
          sub={`${deliverablesByStatus.find((s: any) => s.status === "accepted")?.count ?? 0} accepted`}
        />
        <StatCard
          title="Critical Points"
          value={pointsByCriticality.find((c: any) => c.criticality === "critical")?.count ?? 0}
          icon={<AlertTriangleIcon className="h-5 w-5 text-red-500" />}
          sub="require priority attention"
          color="text-red-600"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Points by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Points by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {pointsByStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pointsByStatus.map((s: any) => ({ name: s.status.replace(/_/g, " "), value: s.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {pointsByStatus.map((s: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#888"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Points by Criticality */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Points by Criticality</CardTitle>
          </CardHeader>
          <CardContent>
            {pointsByCriticality.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={pointsByCriticality.map((c: any) => ({ name: c.criticality, value: c.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {pointsByCriticality.map((c: any, i: number) => (
                      <Cell key={i} fill={CRITICALITY_COLORS[c.criticality] ?? "#888"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* IQs by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">IQs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {iqsByStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No queries yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={iqsByStatus.map((s: any) => ({ name: s.status.replace(/_/g, " "), value: s.count }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name} (${value})`}
                    labelLine={false}
                  >
                    {iqsByStatus.map((s: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#888"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Package Pair Interface Count */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Interface Points by Package Pair</CardTitle>
          </CardHeader>
          <CardContent>
            {pairChartData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No registers yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pairChartData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip />
                  <Bar dataKey="points" radius={[0, 3, 3, 0]}>
                    {pairChartData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Deliverables by Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deliverables by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {deliverablesByStatus.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No deliverables yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deliverablesByStatus.map((s: any) => ({ name: s.status.replace(/_/g, " "), value: s.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {deliverablesByStatus.map((s: any, i: number) => (
                      <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#888"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PowerBI note */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">PowerBI connection:</span>{" "}
            Connect directly to the PostgreSQL database at{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              postgresql://postgres:postgres@127.0.0.1:54322/postgres
            </code>{" "}
            using DirectQuery. Key tables:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">interface_points</code>,{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">interface_queries</code>,{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">deliverables</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
