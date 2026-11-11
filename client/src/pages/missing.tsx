import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle2, Download, Search, Ban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { downloadFile } from "@/lib/labels";
import type { Factory, MissingGarment } from "@shared/schema";

interface MissingResponse {
  days: number;
  missing: MissingGarment[];
  writtenOff: MissingGarment[];
}

const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "-";

function lastSeenText(g: MissingGarment) {
  if (g.lastSeenReason === "found") return "Marked found";
  if (g.lastSeenReason === "created") return "Label printed, never scanned";
  const where = g.lastLocation === "factory" ? "factory" : "laundry";
  return `Scanned ${g.lastDirection} at ${where}`;
}

export default function MissingPage() {
  const { isAdminSession } = useAuth();
  const { toast } = useToast();
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [confirmWriteOff, setConfirmWriteOff] = useState<MissingGarment | null>(null);

  const factoryParam = isAdminSession && factoryFilter !== "all" ? `?factory=${factoryFilter}` : "";
  const { data, isLoading } = useQuery<MissingResponse>({
    queryKey: [`/api/missing${factoryParam}`],
  });
  const { data: factories } = useQuery<Factory[]>({ queryKey: ["/api/factories"] });
  const factoryName = useMemo(
    () => new Map((factories || []).map((f) => [f.id, f.name])),
    [factories],
  );

  const refresh = () => {
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/missing") });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/admin"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/factory"] });
  };

  const foundMutation = useMutation({
    mutationFn: (g: MissingGarment) => apiRequest("POST", `/api/garments/${g.id}/found`),
    onSuccess: (_d, g) => {
      refresh();
      toast({ title: "Marked as found", description: `${g.garmentId} is off the missing list.` });
    },
    onError: (e: any) => toast({ title: "Couldn't mark as found", description: e.message, variant: "destructive" }),
  });

  const writeOffMutation = useMutation({
    mutationFn: (g: MissingGarment) => apiRequest("POST", `/api/garments/${g.id}/write-off`),
    onSuccess: (_d, g) => {
      refresh();
      toast({ title: "Written off", description: `${g.garmentId} moved to Written off.` });
    },
    onError: (e: any) => toast({ title: "Couldn't write off", description: e.message, variant: "destructive" }),
  });

  const matches = (g: MissingGarment) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.garmentId.toLowerCase().includes(q) ||
      g.garmentType.toLowerCase().includes(q) ||
      (factoryName.get(g.factoryId) || "").toLowerCase().includes(q)
    );
  };
  const missing = (data?.missing || []).filter(matches);
  const writtenOff = (data?.writtenOff || []).filter(matches);
  const days = data?.days ?? 28;

  const reportUrl = `/api/missing/report${factoryParam}`;

  const renderTable = (rows: MissingGarment[], kind: "missing" | "writtenOff") => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-600" />
          {kind === "missing"
            ? `Nothing missing. Every garment has been seen in the last ${days} days.`
            : "No garments have been written off."}
        </div>
      );
    }
    return (
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Garment</TableHead>
              {isAdminSession && <TableHead>Factory</TableHead>}
              <TableHead>Last seen</TableHead>
              <TableHead className="text-right">Days</TableHead>
              {isAdminSession && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <p className="font-mono text-sm">{g.garmentId}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.garmentType} · Size {g.size}
                  </p>
                </TableCell>
                {isAdminSession && <TableCell>{factoryName.get(g.factoryId) || "-"}</TableCell>}
                <TableCell>
                  <p className="text-sm">{fmtDate(g.lastSeenAt)}</p>
                  <p className="text-xs text-muted-foreground">{lastSeenText(g)}</p>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={kind === "missing" ? "destructive" : "secondary"}>{g.daysMissing}</Badge>
                </TableCell>
                {isAdminSession && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={foundMutation.isPending}
                        onClick={() => foundMutation.mutate(g)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Found
                      </Button>
                      {kind === "missing" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setConfirmWriteOff(g)}
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Write off
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Missing Garments</h1>
          <p className="text-muted-foreground">
            Garments not scanned for {days} days or more. Scanning a garment takes it off this list.
          </p>
        </div>
        <Button variant="outline" onClick={() => downloadFile(reportUrl)}>
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-lg flex items-center gap-2 mr-auto">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {data ? `${data.missing.length} missing` : "Missing"}
            </CardTitle>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                className="pl-8 w-[220px]"
                placeholder="Search ID, type, factory"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isAdminSession && (
              <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All factories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All factories</SelectItem>
                  {(factories || []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="missing">
            <TabsList>
              <TabsTrigger value="missing">Missing ({missing.length})</TabsTrigger>
              <TabsTrigger value="writtenOff">Written off ({writtenOff.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="missing" className="mt-4">
              {renderTable(missing, "missing")}
            </TabsContent>
            <TabsContent value="writtenOff" className="mt-4">
              {renderTable(writtenOff, "writtenOff")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmWriteOff} onOpenChange={(open) => !open && setConfirmWriteOff(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Write off {confirmWriteOff?.garmentId}?</AlertDialogTitle>
            <AlertDialogDescription>
              It moves to the Written off list. If it's scanned again later, or you press Found, it comes back
              automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmWriteOff) writeOffMutation.mutate(confirmWriteOff);
                setConfirmWriteOff(null);
              }}
            >
              Write off
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
