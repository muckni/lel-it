"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";

export default function CasesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [mocSelection, setMocSelection] = useState<Record<string, string>>({});

  const { data: cases = [] } = useQuery(
    trpc.interfaceCase.listCases.queryOptions({ projectId, limit: 300 })
  );

  const { data: mocs = [] } = useQuery(
    trpc.moc.listByProject.queryOptions({ projectId })
  );

  const linkMocMutation = useMutation(
    trpc.interfaceCase.linkMoc.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.interfaceCase.listCases.queryOptions({ projectId, limit: 300 })
        );
      },
    })
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold">Interface Cases</h1>
        <p className="text-sm text-muted-foreground">
          Manage DIR/TQU lifecycle items and link them to Management of Change records.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Case Register</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>State</TableHead>
                <TableHead>SLA Due</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[280px]">MOC Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell>{item.title}</TableCell>
                  <TableCell>{item.current_state ?? item.currentState}</TableCell>
                  <TableCell>{item.sla_due_at ?? item.slaDueAt ?? "-"}</TableCell>
                  <TableCell>{item.source_entity_type ?? item.sourceEntityType ?? "-"}</TableCell>
                  <TableCell className="flex items-center gap-2">
                    <Select
                      value={mocSelection[item.id] ?? ""}
                      onValueChange={(value) =>
                        setMocSelection((prev) => ({
                          ...prev,
                          [item.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 w-44">
                        <SelectValue placeholder="Select MOC" />
                      </SelectTrigger>
                      <SelectContent>
                        {mocs.map((moc) => (
                          <SelectItem key={moc.id} value={moc.id}>
                            {moc.mocId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!mocSelection[item.id]}
                      onClick={() =>
                        linkMocMutation.mutate({
                          caseId: item.id,
                          mocChangeId: mocSelection[item.id],
                        })
                      }
                    >
                      Link
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No interface cases available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
