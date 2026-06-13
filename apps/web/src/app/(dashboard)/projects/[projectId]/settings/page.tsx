"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  ShieldIcon,
  PencilIcon,
} from "lucide-react";
import { useProjectRole } from "@/hooks/use-project-role";

// ── Invite Form ──────────────────────────────────────────────────────────────

function InviteMemberDialog({
  projectId,
  onSuccess,
}: {
  projectId: string;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);

  const addMember = useMutation(
    trpc.project.addMember.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        setEmail("");
        setError(null);
        onSuccess();
      },
      onError: (err) => setError(err.message),
    })
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger render={
        <Button size="sm"><PlusIcon className="h-4 w-4 mr-1" />Invite Member</Button>
      } />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input
              type="email"
              placeholder="engineer@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access, can manage members</SelectItem>
                <SelectItem value="editor">Editor — create and update data</SelectItem>
                <SelectItem value="viewer">Viewer — read only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            className="w-full"
            onClick={() =>
              addMember.mutate({
                projectId,
                email,
                role,
              })
            }
            disabled={!email || addMember.isPending}
          >
            {addMember.isPending ? "Inviting…" : "Send Invite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Member Dialog ────────────────────────────────────────────────────────

function EditMemberDialog({
  member,
  projectId,
  onSuccess,
}: {
  member: {
    id: string;
    name: string;
    role: string;
  };
  projectId: string;
  onSuccess: () => void;
}) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"admin" | "editor" | "viewer">(member.role as any);

  const updateMember = useMutation(
    trpc.project.updateMember.mutationOptions({
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
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            onClick={() =>
              updateMember.mutate({
                projectId,
                memberId: member.id,
                role,
              })
            }
            disabled={updateMember.isPending}
          >
            {updateMember.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Role Badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    admin: "bg-red-50 text-red-700 border-red-200",
    editor: "bg-blue-50 text-blue-700 border-blue-200",
    viewer: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[role] ?? styles.viewer}`}>
      {role}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { isAdmin } = useProjectRole(projectId);

  const { data: members = [], isLoading: membersLoading } = useQuery(
    trpc.project.listMembers.queryOptions({ projectId })
  );

  const removeMemberMutation = useMutation(
    trpc.project.removeMember.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.project.listMembers.queryOptions({ projectId })),
    })
  );

  function invalidateMembers() {
    queryClient.invalidateQueries(trpc.project.listMembers.queryOptions({ projectId }));
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage team members and access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {members.length} member{members.length !== 1 ? "s" : ""} · admins can invite and remove
              </CardDescription>
            </div>
            {isAdmin && (
              <InviteMemberDialog
                projectId={projectId}
                onSuccess={invalidateMembers}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {membersLoading ? (
            <p className="text-sm text-muted-foreground px-6 py-4">Loading…</p>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <UsersIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No members yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Invite your team. Members must have an existing account.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  {isAdmin && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={m.role} />
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <EditMemberDialog
                            member={m}
                            projectId={projectId}
                            onSuccess={invalidateMembers}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              removeMemberMutation.mutate({ projectId, memberId: m.id })
                            }
                            disabled={removeMemberMutation.isPending}
                          >
                            <Trash2Icon className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* RBAC reference */}
      <div className="rounded-lg border border-dashed p-4">
        <div className="flex items-start gap-3">
          <ShieldIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p><span className="font-medium text-foreground">Admin</span> — invite/remove members, all editor actions</p>
            <p><span className="font-medium text-foreground">Editor</span> — create/update lessons, actions, and related records</p>
            <p><span className="font-medium text-foreground">Viewer</span> — read-only access across all project data</p>
          </div>
        </div>
      </div>
    </div>
  );
}
