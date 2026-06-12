import Link from "next/link";
import {
  BarChart3Icon,
  BookOpenCheckIcon,
  FilterIcon,
  LibraryIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const corporateNav = [
  { label: "Library", href: "/corporate/library", active: true, icon: LibraryIcon },
  { label: "Proposals", href: "/corporate/proposals", active: false, icon: BookOpenCheckIcon },
  { label: "Dashboard", href: "/corporate/dashboard", active: false, icon: BarChart3Icon },
] as const;

const sampleEntries = [
  {
    title: "Require supplier input freeze before design gate",
    category: "Engineering",
    phase: "FEED",
    reuseCount: 6,
    status: "Active",
  },
  {
    title: "Confirm marine logistics assumptions before package award",
    category: "Installation",
    phase: "Procurement",
    reuseCount: 3,
    status: "Active",
  },
  {
    title: "Run cross-package constructability review after layout change",
    category: "Construction",
    phase: "Detailed design",
    reuseCount: 4,
    status: "Active",
  },
] as const;

export default function CorporateLibraryPage() {
  return (
    <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Corporate View
          </p>
          <h1 className="text-2xl font-semibold">Corporate Recommended Actions</h1>
        </div>
        <Button variant="outline">Export</Button>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b">
        {corporateNav.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium whitespace-nowrap",
                item.active
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FilterIcon className="size-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {["Category", "Phase", "Workstream", "Reuse", "Status"].map((filter) => (
              <Button key={filter} variant="outline" className="w-full justify-between">
                {filter}
                <span className="text-muted-foreground">All</span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search title, guidance, category, or tag" />
            </div>
            <Button variant="outline">Most reused</Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            {sampleEntries.map((entry) => (
              <Card key={entry.title}>
                <CardHeader className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                      {entry.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Reused in {entry.reuseCount} projects
                    </span>
                  </div>
                  <CardTitle className="text-base leading-snug">{entry.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded border px-2 py-1">{entry.category}</span>
                    <span className="rounded border px-2 py-1">{entry.phase}</span>
                  </div>
                  <Button className="w-full">
                    <PlusIcon className="size-4" />
                    Add to project
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-end">
            <Link
              href="/lessons-portfolio"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Portfolio cockpit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
