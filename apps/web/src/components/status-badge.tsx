import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const pointStatusConfig = {
  open: { label: "Open", className: "bg-amber-100 text-amber-800 border-amber-200" },
  in_progress: { label: "In Progress", className: "bg-blue-100 text-blue-800 border-blue-200" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 border-green-200" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const criticalityConfig = {
  critical: { label: "Critical", className: "bg-red-100 text-red-800 border-red-200" },
  major: { label: "Major", className: "bg-orange-100 text-orange-800 border-orange-200" },
  minor: { label: "Minor", className: "bg-slate-100 text-slate-700 border-slate-200" },
};

const registerStatusConfig = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  active: { label: "Active", className: "bg-green-100 text-green-800 border-green-200" },
  closed: { label: "Closed", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const agreementStatusConfig = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800 border-blue-200" },
  agreed: { label: "Agreed", className: "bg-green-100 text-green-800 border-green-200" },
  superseded: { label: "Superseded", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export function PointStatusBadge({ status }: { status: keyof typeof pointStatusConfig }) {
  const cfg = pointStatusConfig[status] ?? pointStatusConfig.open;
  return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
}

export function CriticalityBadge({ criticality }: { criticality: keyof typeof criticalityConfig }) {
  const cfg = criticalityConfig[criticality] ?? criticalityConfig.minor;
  return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
}

export function RegisterStatusBadge({ status }: { status: keyof typeof registerStatusConfig }) {
  const cfg = registerStatusConfig[status] ?? registerStatusConfig.draft;
  return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
}

export function AgreementStatusBadge({ status }: { status: keyof typeof agreementStatusConfig }) {
  const cfg = agreementStatusConfig[status] ?? agreementStatusConfig.draft;
  return <Badge variant="outline" className={cn("text-xs font-medium", cfg.className)}>{cfg.label}</Badge>;
}
