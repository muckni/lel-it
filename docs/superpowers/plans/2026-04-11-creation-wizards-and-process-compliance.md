# Creation Wizards & Process Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken build, add guided creation wizards for the full interface management hierarchy (Project Setup → Work Packages → Registers → Agreements → Interface Points → DIRs/TQUs), and align the data model with the Gennaker/Skyborn Interface Management Plan (IMP R05) and Interface Matrix (ERQ-4 R07).

**Architecture:** Multi-step wizard dialogs for each entity type, following the IMP process hierarchy: Work Packages define contractor scope → Interface Registers define pairwise WP boundaries → Agreements formalize interface items → Interface Points specify scope-allocation per EPCI phase → TQUs (Technical Queries) resolve open items between Requesting Party and Providing Party. The MOC (Management of Change) process triggers when a change crosses a threshold or affects ≥2 packages.

**Tech Stack:** Next.js 16.2 (Turbopack), React 19, tRPC v11, TanStack Query v5, Drizzle ORM, shadcn/ui (dialog, select, input, label, textarea, tabs, table, badge, button already installed), Zod v4, Vitest.

**IMPORTANT:** This is Next.js 16 with breaking changes. Before writing any code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices. Notably: `useSearchParams()` requires a `<Suspense>` boundary.

---

## Codex Change Review (Post-573458b)

### What Codex shipped (commits 0c3d182 → 0f69666):
1. **CreateProjectDialog** — works end-to-end, auto-creates portfolio, auto-creates admin membership
2. **Dashboard** — "New Project" buttons in header, sidebar, and empty state
3. **Sidebar** — "New Project" opens dialog directly instead of navigating
4. **Portfolio router** — `createProject` now wraps insert + admin membership in a transaction
5. **Phases 7–9** — Attachments, deadlines, compliance, MOC, matrix, tracker, cases, workspace, 3D model registry

### Bugs found:
1. **BUILD BROKEN** — `useSearchParams()` in `apps/web/src/app/(dashboard)/page.tsx` without `<Suspense>` boundary. This crashes the production build entirely. All pages are inaccessible.
2. **Phase field silently discarded** — CreateProjectDialog collects phase but never sends it to backend mutation.
3. **No work package edit UI** — Backend `workPackage.update` exists but no form/dialog exposes it.

### Why "can't add work packages":
The build crash from bug #1 means the deployed app cannot render. In dev mode it may partially work, but the Settings page depends on `useProjectRole` → `project.myRole`, which requires the user to be a project member. If the auto-membership from `portfolio.createProject` fails silently or the user navigates via a stale URL, the `canEdit` flag is false and the "Add Package" button is hidden.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/app/(dashboard)/page.tsx` | **Modify** | Fix Suspense boundary, fix phase field |
| `apps/web/src/components/create-project-dialog.tsx` | **Modify** | Send phase to backend |
| `apps/web/src/server/routers/portfolio.ts` | **Modify** | Accept phase in createProject input |
| `apps/web/src/components/wizards/project-setup-wizard.tsx` | **Create** | Multi-step project setup: info → work packages → first register |
| `apps/web/src/components/wizards/register-wizard.tsx` | **Create** | Guided register + agreement creation |
| `apps/web/src/components/wizards/interface-point-wizard.tsx` | **Create** | Create interface point with scope-allocation columns per IMP §3.3.3 |
| `apps/web/src/components/wizards/tqu-wizard.tsx` | **Create** | Create TQU/DIR with RP/PP assignment per IMP §3.1 |
| `apps/web/src/components/forms/work-package-form.tsx` | **Modify** | Support edit mode (pre-populated values) |
| `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx` | **Modify** | Add edit dialog for work packages, empty-state "Setup Wizard" CTA |
| `apps/web/src/app/(dashboard)/projects/[projectId]/registers/page.tsx` | **Modify** | Add register creation wizard entry point |
| `apps/web/src/server/routers/interface-point.ts` | **Modify** | Add scope-allocation fields to create/update |
| `packages/db/src/schema.ts` | **Modify** | Add scope-allocation columns to interface_points |
| `packages/shared/src/enums.ts` | **Modify** | Add scope-allocation responsibility enum, EPCI phase columns |

---

## Task 1: Fix the broken build (Suspense boundary)

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`

The production build crashes because `useSearchParams()` is called without a `<Suspense>` boundary (Next.js 16 requirement).

- [ ] **Step 1: Wrap the dashboard page content in a Suspense boundary**

Extract the component that uses `useSearchParams()` into a separate inner component and wrap it:

```tsx
// apps/web/src/app/(dashboard)/page.tsx
import { Suspense } from "react";

function DashboardContent() {
  // ... all existing code from DashboardPage() currently
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading...</p>}>
      <DashboardContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `pnpm --filter @owit/web build`
Expected: Build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/page.tsx
git commit -m "fix: wrap useSearchParams in Suspense boundary to fix production build"
```

---

## Task 2: Fix phase field in CreateProjectDialog

**Files:**
- Modify: `apps/web/src/components/create-project-dialog.tsx`
- Modify: `apps/web/src/server/routers/portfolio.ts`

The dialog collects a `phase` value but never sends it. The backend also doesn't accept it yet.

- [ ] **Step 1: Add phase to the portfolio.createProject input schema**

In `apps/web/src/server/routers/portfolio.ts`, update the input:

```ts
.input(
  z.object({
    portfolioId: z.string().uuid(),
    name: z.string().min(1).max(255),
    description: z.string().optional(),
    phase: z.enum([
      "maturation", "feed", "detailed_design", "procurement",
      "fabrication", "installation", "commissioning", "operations",
    ]).optional(),
  })
)
```

And include `phase` in the insert values:

```ts
const [project] = await tx
  .insert(projects)
  .values({
    portfolioId: input.portfolioId,
    name: input.name,
    description: input.description,
    phase: input.phase,
  })
  .returning();
```

- [ ] **Step 2: Send phase from the dialog**

In `apps/web/src/components/create-project-dialog.tsx`, update the mutation call (around line 90) to include the phase:

```ts
const project = await createProject.mutateAsync({
  portfolioId,
  name: values.name.trim(),
  description: values.description?.trim() || undefined,
  phase: values.phase || undefined,
});
```

- [ ] **Step 3: Verify build passes**

Run: `pnpm --filter @owit/web build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/create-project-dialog.tsx apps/web/src/server/routers/portfolio.ts
git commit -m "fix: send phase field from create-project dialog to backend"
```

---

## Task 3: Add work package edit capability

**Files:**
- Modify: `apps/web/src/components/forms/work-package-form.tsx` (already supports `defaultValues` — just needs edit dialog wrapper)
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`

The backend `workPackage.update` mutation exists but no UI exposes it.

- [ ] **Step 1: Add EditWorkPackageDialog to the settings page**

In `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`, add a new dialog component similar to the existing create flow. Use the existing `WorkPackageForm` with `defaultValues` pre-populated from the selected work package:

```tsx
function EditWorkPackageDialog({
  workPackage,
  projectId,
  onSuccess,
}: {
  workPackage: { id: string; code: string; name: string; description: string | null; responsibleOrg: string | null; color: string };
  projectId: string;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const updateMutation = useMutation(
    trpc.workPackage.update.mutationOptions({
      onSuccess: () => { setOpen(false); onSuccess(); },
    })
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <PencilIcon className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {workPackage.code}</DialogTitle>
        </DialogHeader>
        <WorkPackageForm
          defaultValues={{
            code: workPackage.code,
            name: workPackage.name,
            description: workPackage.description ?? undefined,
            responsibleOrg: workPackage.responsibleOrg ?? undefined,
            color: workPackage.color,
          }}
          onSubmit={(v) => updateMutation.mutate({ id: workPackage.id, ...v })}
          isLoading={updateMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire the edit button into the work package list**

In the work package list (around line 406), add the edit button next to the delete button:

```tsx
{canEdit && (
  <div className="flex items-center gap-1">
    <EditWorkPackageDialog
      workPackage={wp}
      projectId={projectId}
      onSuccess={() => queryClient.invalidateQueries(trpc.workPackage.list.queryOptions({ projectId }))}
    />
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={() => deleteWpMutation.mutate({ id: wp.id })}
      disabled={deleteWpMutation.isPending}
    >
      <Trash2Icon className="h-3.5 w-3.5" />
    </Button>
  </div>
)}
```

- [ ] **Step 3: Verify build passes, test manually**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/projects/\[projectId\]/settings/page.tsx
git commit -m "feat: add work package edit dialog in project settings"
```

---

## Task 4: Project Setup Wizard (onboarding flow)

**Files:**
- Create: `apps/web/src/components/wizards/project-setup-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`

After creating a project, users see an empty overview with "No work packages yet. Go to Settings → Work Packages." This is poor UX. Instead, offer a guided setup wizard.

The wizard has 3 steps:
1. **Work Packages** — seed industry templates or add manually (mirrors IMP §3.3.5 stakeholder list: WTG, FDE, FFA-MP, FFA-TP, FTI, IAG, WTG-TIN, DDOM, TSO GRD, TSO OSS, EMPL)
2. **First Register** — pick two packages to create the first interface register (mirrors ERQ-4 Interface Matrix structure)
3. **Done** — summary + link to Settings for further config

- [ ] **Step 1: Create the wizard component**

Create `apps/web/src/components/wizards/project-setup-wizard.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WorkPackageForm, type WorkPackageFormValues } from "@/components/forms/work-package-form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2Icon, PackageIcon, FileTextIcon, RocketIcon } from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "packages" | "register" | "done";

export function ProjectSetupWizard({ projectId, open, onOpenChange }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("packages");
  const [showCustomForm, setShowCustomForm] = useState(false);

  const { data: workPackages = [], refetch: refetchWps } = useQuery(
    trpc.workPackage.list.queryOptions({ projectId })
  );

  const seedMutation = useMutation(
    trpc.workPackage.seedDefaults.mutationOptions({
      onSuccess: () => {
        refetchWps();
        queryClient.invalidateQueries(trpc.workPackage.list.queryOptions({ projectId }));
      },
    })
  );

  const createWpMutation = useMutation(
    trpc.workPackage.create.mutationOptions({
      onSuccess: () => {
        refetchWps();
        setShowCustomForm(false);
      },
    })
  );

  // Register creation state
  const [registerName, setRegisterName] = useState("");
  const [packageAId, setPackageAId] = useState("");
  const [packageBId, setPackageBId] = useState("");

  const createRegisterMutation = useMutation(
    trpc.register.create.mutationOptions({
      onSuccess: () => setStep("done"),
    })
  );

  const stepIndicator = (
    <div className="flex items-center gap-2 mb-6">
      {[
        { key: "packages", label: "1. Work Packages", icon: PackageIcon },
        { key: "register", label: "2. First Register", icon: FileTextIcon },
        { key: "done", label: "3. Ready", icon: RocketIcon },
      ].map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className={`flex items-center gap-1.5 text-xs font-medium ${
            step === key ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Project Setup</DialogTitle>
          <DialogDescription>
            Configure your project's interface structure step by step.
          </DialogDescription>
        </DialogHeader>

        {stepIndicator}

        {step === "packages" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Work packages represent the contractor scopes in your project (e.g. WTG, Foundation, IAG).
              Each interface register connects two work packages.
            </p>

            {workPackages.length > 0 && (
              <div className="space-y-1.5">
                {workPackages.map((wp) => (
                  <div key={wp.id} className="flex items-center gap-2 text-sm">
                    <span className="h-3 w-3 rounded-full" style={{ background: wp.color }} />
                    <span className="font-mono text-xs font-semibold">{wp.code}</span>
                    <span>{wp.name}</span>
                  </div>
                ))}
              </div>
            )}

            {workPackages.length === 0 && !showCustomForm && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => seedMutation.mutate({ projectId })}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending ? "Loading..." : "Use Industry Templates"}
                </Button>
                <Button variant="outline" onClick={() => setShowCustomForm(true)}>
                  Add Custom
                </Button>
              </div>
            )}

            {showCustomForm && (
              <WorkPackageForm
                onSubmit={(v: WorkPackageFormValues) => createWpMutation.mutate({ projectId, ...v })}
                isLoading={createWpMutation.isPending}
              />
            )}

            {workPackages.length > 0 && !showCustomForm && (
              <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)}>
                + Add Another
              </Button>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep("register")}
                disabled={workPackages.length < 2}
              >
                Next: Create Register
              </Button>
            </div>
            {workPackages.length < 2 && workPackages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                You need at least 2 work packages to create an interface register.
              </p>
            )}
          </div>
        )}

        {step === "register" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An interface register tracks all interfaces between two work packages.
              For example: WTG ↔ FOU tracks all WTG-Foundation interfaces.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Register Name</Label>
                <Input
                  placeholder="e.g. WTG-FOU Interfaces"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Package A</Label>
                  <Select value={packageAId} onValueChange={setPackageAId}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {workPackages
                        .filter((wp) => wp.id !== packageBId)
                        .map((wp) => (
                          <SelectItem key={wp.id} value={wp.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: wp.color }} />
                              {wp.code} — {wp.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Package B</Label>
                  <Select value={packageBId} onValueChange={setPackageBId}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {workPackages
                        .filter((wp) => wp.id !== packageAId)
                        .map((wp) => (
                          <SelectItem key={wp.id} value={wp.id}>
                            <span className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: wp.color }} />
                              {wp.code} — {wp.name}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep("packages")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("done")}>
                  Skip
                </Button>
                <Button
                  onClick={() =>
                    createRegisterMutation.mutate({
                      projectId,
                      name: registerName || `${workPackages.find((w) => w.id === packageAId)?.code}-${workPackages.find((w) => w.id === packageBId)?.code}`,
                      packageAId,
                      packageBId,
                    })
                  }
                  disabled={!packageAId || !packageBId || createRegisterMutation.isPending}
                >
                  {createRegisterMutation.isPending ? "Creating..." : "Create Register"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <CheckCircle2Icon className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Setup Complete</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your project has {workPackages.length} work packages.
                You can add more packages, registers, and team members in Settings.
              </p>
            </div>
            <Button onClick={() => onOpenChange(false)}>
              Go to Project
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add "Setup Wizard" CTA to the project overview page**

In `apps/web/src/app/(dashboard)/projects/[projectId]/page.tsx`, when work packages are empty, show a button that opens the wizard instead of just text:

```tsx
import { ProjectSetupWizard } from "@/components/wizards/project-setup-wizard";
// ... in the component:
const [showSetupWizard, setShowSetupWizard] = useState(false);
// ... in the empty work packages section:
<Button size="sm" onClick={() => setShowSetupWizard(true)}>
  Run Setup Wizard
</Button>
<ProjectSetupWizard
  projectId={projectId}
  open={showSetupWizard}
  onOpenChange={setShowSetupWizard}
/>
```

- [ ] **Step 3: Add "Setup Wizard" CTA to settings page empty state**

In `apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`, add a "Run Setup Wizard" button in the work packages empty state alongside the existing "Use Industry Templates" button.

- [ ] **Step 4: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/wizards/project-setup-wizard.tsx \
  apps/web/src/app/\(dashboard\)/projects/\[projectId\]/page.tsx \
  apps/web/src/app/\(dashboard\)/projects/\[projectId\]/settings/page.tsx
git commit -m "feat: add project setup wizard (work packages → first register)"
```

---

## Task 5: Scope-allocation columns for Interface Points (IMP compliance)

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/shared/src/enums.ts`
- Modify: `apps/web/src/server/routers/interface-point.ts`

The Interface Matrix (ERQ-4 §3.3.3) defines scope-allocation columns per EPCI phase. Each interface component has a responsible party per phase. Currently, interface points only have a `status` and `priority` — they lack the scope-allocation structure that the IMP mandates.

**Scope-allocation columns from IMP §3.3.3 / ERQ-4:**
- `scopeSpec` — Specification/requirements: who defines interface design requirements
- `scopeDes` — Design and engineering: who designs the interface component
- `scopeSup` — Supply, provision, execution: who supplies/purchases
- `scopeOnA` — Onshore assembly: who pre-assembles onshore
- `scopeOnT` — Onshore transport/delivery: who delivers to base port
- `scopeOnC` — Onshore commissioning and testing
- `scopeOffT` — Offshore transport to site
- `scopeOffI` — Offshore assembly or installation
- `scopeOffC` — Offshore commissioning and testing

Each column contains the work package code of the responsible party (e.g., "FOU", "WTG", "IAG") or "n.r." / null if not relevant.

- [ ] **Step 1: Add the scope-allocation enum to shared enums**

In `packages/shared/src/enums.ts`, add:

```ts
/** EPCI scope-allocation phases per IMP §3.3.3 */
export const SCOPE_ALLOCATION_PHASES = [
  { key: "scopeSpec", label: "Spec", description: "Specification, requirements" },
  { key: "scopeDes", label: "Des", description: "Design and engineering" },
  { key: "scopeSup", label: "Sup", description: "Supply, provision, execution" },
  { key: "scopeOnA", label: "On-A", description: "Onshore assembly" },
  { key: "scopeOnT", label: "On-T", description: "Onshore transport / delivery" },
  { key: "scopeOnC", label: "On-C", description: "Onshore commissioning and testing" },
  { key: "scopeOffT", label: "Off-T", description: "Offshore transport to site" },
  { key: "scopeOffI", label: "Off-I", description: "Offshore assembly or installation" },
  { key: "scopeOffC", label: "Off-C", description: "Offshore commissioning and testing" },
] as const;

export type ScopeAllocationPhase = typeof SCOPE_ALLOCATION_PHASES[number]["key"];
```

- [ ] **Step 2: Add scope-allocation columns to interface_points schema**

In `packages/db/src/schema.ts`, add 9 nullable varchar columns to the `interfacePoints` table:

```ts
scopeSpec: varchar("scope_spec", { length: 20 }),
scopeDes: varchar("scope_des", { length: 20 }),
scopeSup: varchar("scope_sup", { length: 20 }),
scopeOnA: varchar("scope_on_a", { length: 20 }),
scopeOnT: varchar("scope_on_t", { length: 20 }),
scopeOnC: varchar("scope_on_c", { length: 20 }),
scopeOffT: varchar("scope_off_t", { length: 20 }),
scopeOffI: varchar("scope_off_i", { length: 20 }),
scopeOffC: varchar("scope_off_c", { length: 20 }),
```

- [ ] **Step 3: Generate migration**

Run: `pnpm --filter @owit/db db:generate`
Expected: New migration SQL file created.

- [ ] **Step 4: Add scope-allocation fields to interface-point router**

In `apps/web/src/server/routers/interface-point.ts`, update the `create` and `update` input schemas to accept optional scope-allocation fields:

```ts
const scopeAllocationSchema = z.object({
  scopeSpec: z.string().max(20).optional(),
  scopeDes: z.string().max(20).optional(),
  scopeSup: z.string().max(20).optional(),
  scopeOnA: z.string().max(20).optional(),
  scopeOnT: z.string().max(20).optional(),
  scopeOnC: z.string().max(20).optional(),
  scopeOffT: z.string().max(20).optional(),
  scopeOffI: z.string().max(20).optional(),
  scopeOffC: z.string().max(20).optional(),
});
```

Merge this into both the `create` and `update` input objects.

- [ ] **Step 5: Verify build + run tests**

Run: `pnpm --filter @owit/web build && pnpm --filter @owit/web test`

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/ packages/shared/src/enums.ts \
  apps/web/src/server/routers/interface-point.ts
git commit -m "feat: add EPCI scope-allocation columns to interface points (IMP §3.3.3)"
```

---

## Task 6: Interface Point Creation Wizard with Scope Allocation

**Files:**
- Create: `apps/web/src/components/wizards/interface-point-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/registers/[registerId]/agreements/[agreementId]/points/[pointId]/page.tsx` (or wherever points are created)

A multi-step dialog:
1. **Basic info** — title, description, category (interface group per ERQ-4 §3.3.2), interface component
2. **Scope allocation** — 9-column grid with dropdowns for each EPCI phase, pre-populated from the register's two work packages
3. **Review + create**

- [ ] **Step 1: Create the interface point wizard component**

Create `apps/web/src/components/wizards/interface-point-wizard.tsx` with a 2-step form:

Step 1 fields: title (required), description (optional), priority (optional).

Step 2: A grid of 9 scope-allocation columns, each with a `<Select>` dropdown whose options are the two work packages from the parent agreement/register, plus "n.r." (not relevant) and "multiple" (shared responsibility). Use `SCOPE_ALLOCATION_PHASES` from shared enums for labels and descriptions.

The wizard calls `interfacePoint.create` with all fields on submit.

- [ ] **Step 2: Wire the wizard into the interface point creation flow**

Replace the existing "create point" button/dialog in the agreement detail page with this wizard.

- [ ] **Step 3: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizards/interface-point-wizard.tsx \
  "apps/web/src/app/(dashboard)/projects/[projectId]/registers/"
git commit -m "feat: add interface point creation wizard with scope allocation"
```

---

## Task 7: TQU/DIR Creation Wizard (IMP §3.1 compliance)

**Files:**
- Create: `apps/web/src/components/wizards/tqu-wizard.tsx`

Per IMP §3.1: "Clarification of existing Interfaces, as well as identification of new Interfaces shall be done via Technical Queries (TQU). Within a TQU a Detailed Information Requirement (DIR) regarding a certain Interface is formulated by the Requesting Party (RP) and sent to the Providing Party (PP)."

The wizard maps to our existing `interfaceQuery` entity (TQU = Technical Query):

1. **Select Interface Point** — pick the interface point this TQU relates to
2. **Parties** — select Requesting Party (RP) work package and Providing Party (PP) work package
3. **DIR Details** — subject, detailed description, due date (IMP mandates 14 calendar days default)
4. **Review + create**

- [ ] **Step 1: Create the TQU wizard component**

```tsx
"use client";

// ... imports ...

interface Props {
  projectId: string;
  registerId?: string; // optional pre-filter
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TquWizard({ projectId, registerId, open, onOpenChange }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"point" | "parties" | "details" | "review">("point");

  // ... form state for interfacePointId, raisedByPackageId, assignedToPackageId, subject, description, dueDate ...

  // Default due date = today + 14 calendar days (IMP §3.1)
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);

  // ... step UI ...
  // On final submit: call interfaceQuery.create mutation
}
```

- [ ] **Step 2: Wire into the queries page and interface point detail page**

Add a "New TQU" button to both the queries list page and the interface point detail page that opens this wizard.

- [ ] **Step 3: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizards/tqu-wizard.tsx \
  "apps/web/src/app/(dashboard)/projects/[projectId]/queries/"
git commit -m "feat: add TQU/DIR creation wizard with RP/PP assignment (IMP §3.1)"
```

---

## Task 8: Register Creation Wizard

**Files:**
- Create: `apps/web/src/components/wizards/register-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/projects/[projectId]/registers/page.tsx`

A guided flow for creating a register + its first agreement:

1. **Select packages** — pick Package A and Package B
2. **Register details** — name (auto-generated as "{codeA}-{codeB} Interfaces"), description
3. **First agreement** — title, discipline, initial status
4. **Create**

- [ ] **Step 1: Create the register wizard**

Follows same pattern as project-setup-wizard: multi-step dialog, calls `register.create` then optionally `agreement.create`.

- [ ] **Step 2: Wire into registers page**

Replace the existing "New Register" button with the wizard trigger.

- [ ] **Step 3: Verify build passes**

Run: `pnpm --filter @owit/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizards/register-wizard.tsx \
  "apps/web/src/app/(dashboard)/projects/[projectId]/registers/page.tsx"
git commit -m "feat: add register creation wizard with first agreement step"
```

---

## Task 9: Run full test suite and final build verification

**Files:** None created — validation only.

- [ ] **Step 1: Run unit tests**

Run: `pnpm --filter @owit/web test`
Expected: All tests pass (20+).

- [ ] **Step 2: Run production build**

Run: `pnpm --filter @owit/web build`
Expected: Build completes without errors.

- [ ] **Step 3: Commit any remaining fixes**

---

## Process Compliance Summary

| IMP Reference | OWIT Feature | Status |
|---------------|-------------|--------|
| §1.2 Interface = boundary between 2+ scopes of work | Work Packages = contractor scopes | ✅ Exists |
| §2.3 Interface Manager role | Project admin role | ✅ Exists |
| §2.4 Interface Coordinators | Project editor role per work package | ✅ Exists (member ↔ WP assignment) |
| §2.5 Requesting Party / Providing Party | TQU raisedByPackage / assignedToPackage | ✅ Exists |
| §3.1 TQU with DIR, 14-day review period | Interface Query with default due date | Task 7 |
| §3.2 Interface Meetings | Calendar page | ✅ Exists |
| §3.3.1 Org section (unique ID scheme) | Auto-generated codes (IR-001, IA-001, IP-001) | ✅ Exists |
| §3.3.2 Interface section (groups + components) | Interface Points with title/description | ✅ Exists |
| §3.3.3 Scope-allocation (9 EPCI columns) | scope_* columns on interface_points | Task 5 |
| §3.3.5 Stakeholder list with color codes | Work packages with color + code | ✅ Exists |
| §3.4 Allocation of responsibilities (single RP per interface) | Scope-allocation columns | Task 5 |
| ERQ-4 Interface Matrix structure | Matrix page + scope-allocation | Task 5–6 |
| MOC Process (change ≥ threshold or ≥2 packages) | MOC page | ✅ Exists (Phase 9) |
| Internal Interface Tracker (append-only log) | Activity feed + comments | ✅ Exists |

## Items NOT in this plan (future work):
- **Document control** — revision history, approval workflows (IMP §3.3.1 EMPL Rev column)
- **Monthly progress report generation** — automated interface status reports (IMP §3.4)
- **Interface Drawing** — schematic visualization of the Interface Matrix (IMP abbreviations)
- **Bulk Excel import** — import work packages and interface points from ERQ-4 spreadsheet
- **14-day SLA enforcement** — automated reminders when TQU response is overdue
- **Decision Log** — MOC decision tracking with cost impact thresholds (MOC Process §12)
