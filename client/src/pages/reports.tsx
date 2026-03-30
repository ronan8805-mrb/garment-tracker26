import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  Search,
  Calendar,
  Building2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Barcode,
  CalendarDays,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Factory, ScanBatch } from "@shared/schema";

interface ScanDate {
  date: string;
  count: number;
}

interface ReportItem {
  garmentId: string;
  garmentType: string;
  size: string;
  direction: string;
  location: string;
  scannedAt: string | null;
  scannedBy: string;
  duplicate: boolean;
}

interface DateReportData {
  date: string;
  factoryName: string;
  totalScans: number;
  inCount: number;
  outCount: number;
  items: ReportItem[];
}

interface BatchReportData {
  batchNumber: string;
  factoryName: string;
  factoryCode: string;
  location: string;
  direction: string;
  totalItems: number;
  createdAt: string | null;
  completedAt: string | null;
  scannedBy: string;
  items: ReportItem[];
}

export default function ReportsPage() {
  // Daily tab filters
  const [dateFactory, setDateFactory] = useState<string>("all");

  // Batch tab filters
  const [batchFactory, setBatchFactory] = useState<string>("all");
  const [batchDirection, setBatchDirection] = useState<string>("all");
  const [batchSearch, setBatchSearch] = useState("");

  // Viewer state
  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [viewingDateFactory, setViewingDateFactory] = useState<string | null>(null);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);

  const { isAdminSession, isFactorySession, factorySession } = useAuth();

  const { data: factories } = useQuery<Factory[]>({
    queryKey: ["/api/factories"],
  });

  const factoryDisplayName = isFactorySession
    ? factorySession?.factoryName || "Your Factory"
    : dateFactory !== "all"
      ? factories?.find((f) => f.id === dateFactory)?.name || "Unknown"
      : "All Factories";

  // Daily scan dates — filtered by factory (admin picks, factory auto-filtered by server)
  const dateQueryUrl =
    isAdminSession && dateFactory !== "all"
      ? `/api/scan-dates?factory=${dateFactory}`
      : "/api/scan-dates";

  const { data: scanDates, isLoading: datesLoading } = useQuery<ScanDate[]>({
    queryKey: [dateQueryUrl],
  });

  const { data: batches, isLoading: batchesLoading } = useQuery<ScanBatch[]>({
    queryKey: ["/api/batches"],
  });

  // In-app date report viewer — passes factory filter
  const { data: dateReport, isLoading: dateReportLoading } = useQuery<DateReportData>({
    queryKey: ["/api/scan-dates", viewingDate, "data", viewingDateFactory],
    queryFn: async () => {
      const params = viewingDateFactory ? `?factory=${viewingDateFactory}` : "";
      const res = await fetch(`/api/scan-dates/${viewingDate}/data${params}`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !!viewingDate,
  });

  // In-app batch report viewer
  const { data: batchReport, isLoading: batchReportLoading } = useQuery<BatchReportData>({
    queryKey: ["/api/batches", viewingBatchId, "data"],
    queryFn: async () => {
      const res = await fetch(`/api/batches/${viewingBatchId}/data`);
      if (!res.ok) throw new Error("Failed to load report");
      return res.json();
    },
    enabled: !!viewingBatchId,
  });

  const filteredBatches = batches?.filter((b) => {
    const matchesSearch = b.batchNumber.toLowerCase().includes(batchSearch.toLowerCase());
    const matchesFactory = batchFactory === "all" || b.factoryId === batchFactory;
    const matchesDirection = batchDirection === "all" || b.direction === batchDirection;
    return matchesSearch && matchesFactory && matchesDirection;
  });

  const getFactoryName = (factoryId: string) =>
    factories?.find((f) => f.id === factoryId)?.name || "Unknown";

  const selectedDateFactoryName = factoryDisplayName;

  const handleViewDateReport = (date: string) => {
    setViewingDateFactory(dateFactory === "all" ? null : dateFactory);
    setViewingDate(date);
  };

  const handleDownloadDateReport = (date: string) => {
    const factoryParam =
      isAdminSession && dateFactory !== "all" ? `?factory=${dateFactory}` : "";
    window.open(`/api/scan-dates/${date}/report${factoryParam}`, "_blank");
  };

  const handleDownloadDateReportFromViewer = () => {
    if (!viewingDate) return;
    const factoryParam = viewingDateFactory ? `?factory=${viewingDateFactory}` : "";
    window.open(`/api/scan-dates/${viewingDate}/report${factoryParam}`, "_blank");
  };

  const handleDownloadBatchReport = (batchId: string) => {
    window.open(`/api/batches/${batchId}/report`, "_blank");
  };

  const handleDownloadBarcodes = (factoryId: string) => {
    window.open(`/api/factories/${factoryId}/qr-codes`, "_blank");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const fmtTime = (d: string | null) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const fmtDateTime = (d: string | null) => {
    if (!d) return "-";
    const dt = new Date(d);
    return dt.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isFactorySession ? `${factorySession?.factoryName || "Factory"} Reports` : "Garment Reports"}
          </h1>
          <p className="text-muted-foreground">
            {isFactorySession
              ? "View your scan history and download reports"
              : "View and download scan reports by date or batch"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="dates">
            <TabsList className="mb-4">
              <TabsTrigger value="dates" className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                By Date
              </TabsTrigger>
              <TabsTrigger value="batches" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                By Batch
              </TabsTrigger>
            </TabsList>

            {/* ── DAILY REPORTS TAB ── */}
            <TabsContent value="dates">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Daily Scan Reports</CardTitle>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    {isAdminSession && (
                      <Select value={dateFactory} onValueChange={setDateFactory}>
                        <SelectTrigger className="w-[200px]">
                          <Building2 className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Select Factory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Factories</SelectItem>
                          {factories?.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} ({f.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      <Building2 className="w-3 h-3 mr-1" />
                      {selectedDateFactoryName}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {datesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : scanDates && scanDates.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Factory</TableHead>
                            <TableHead>Total Scans</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scanDates.map((sd) => (
                            <TableRow
                              key={sd.date}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleViewDateReport(sd.date)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <span className="font-medium">
                                      {formatDate(sd.date)}
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      {sd.date}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  <Building2 className="w-3 h-3 mr-1" />
                                  {selectedDateFactoryName}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-sm">
                                  {sd.count} scans
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleViewDateReport(sd.date);
                                    }}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const factoryParam =
                                        isAdminSession && dateFactory !== "all"
                                          ? `?factory=${dateFactory}`
                                          : "";
                                      window.open(
                                        `/api/scan-dates/${sd.date}/barcodes${factoryParam}`,
                                        "_blank"
                                      );
                                    }}
                                  >
                                    <Barcode className="w-4 h-4 mr-1" />
                                    Barcodes
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadDateReport(sd.date);
                                    }}
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    PDF
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <CalendarDays className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">No scan history</h3>
                      <p className="text-muted-foreground">
                        {dateFactory !== "all"
                          ? `No scans found for ${selectedDateFactoryName}`
                          : "Scan garments to see daily reports here"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── BATCH REPORTS TAB ── */}
            <TabsContent value="batches">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Batch Reports</CardTitle>
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search batches..."
                        value={batchSearch}
                        onChange={(e) => setBatchSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {isAdminSession ? (
                      <Select
                        value={batchFactory}
                        onValueChange={setBatchFactory}
                      >
                        <SelectTrigger className="w-[200px]">
                          <Building2 className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Factory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Factories</SelectItem>
                          {factories?.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name} ({f.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-sm px-3 py-1">
                        <Building2 className="w-3 h-3 mr-1" />
                        {factorySession?.factoryName || "Your Factory"}
                      </Badge>
                    )}
                    <Select
                      value={batchDirection}
                      onValueChange={setBatchDirection}
                    >
                      <SelectTrigger className="w-[140px]">
                        <Filter className="w-4 h-4 mr-2" />
                        <SelectValue placeholder="Direction" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="IN">Receiving (IN)</SelectItem>
                        <SelectItem value="OUT">Sending (OUT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {batchesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))}
                    </div>
                  ) : filteredBatches && filteredBatches.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Batch</TableHead>
                            <TableHead>Factory</TableHead>
                            <TableHead>Direction</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredBatches.map((batch) => (
                            <TableRow key={batch.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">
                                    {batch.batchNumber}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {getFactoryName(batch.factoryId)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    batch.direction === "IN"
                                      ? "bg-green-500/10 text-green-600 border-green-500/20"
                                      : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                  }
                                >
                                  {batch.direction === "IN" ? (
                                    <ArrowDownToLine className="w-3 h-3 mr-1" />
                                  ) : (
                                    <ArrowUpFromLine className="w-3 h-3 mr-1" />
                                  )}
                                  {batch.direction} @ {batch.location}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="font-medium">
                                  {batch.totalItems}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {batch.createdAt
                                  ? fmtDateTime(batch.createdAt)
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setViewingBatchId(batch.id)
                                    }
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      window.open(`/api/batches/${batch.id}/barcodes`, "_blank")
                                    }
                                  >
                                    <Barcode className="w-4 h-4 mr-1" />
                                    Barcodes
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      handleDownloadBatchReport(batch.id)
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    PDF
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">
                        No batches found
                      </h3>
                      <p className="text-muted-foreground">
                        {batchSearch ||
                        batchFactory !== "all" ||
                        batchDirection !== "all"
                          ? "Try adjusting your filters"
                          : isFactorySession
                            ? "Complete a scan batch to see your reports here"
                            : "Complete a scan batch to see it here"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ── SIDEBAR ── */}
        <div className="space-y-4">
          {isAdminSession && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Barcode Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download barcode sheets for all garments assigned to a
                  factory.
                </p>
                {factories && factories.length > 0 ? (
                  <div className="space-y-2">
                    {factories.map((factory) => (
                      <Button
                        key={factory.id}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleDownloadBarcodes(factory.id)}
                      >
                        <Barcode className="w-4 h-4 mr-2" />
                        {factory.name} ({factory.code})
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No factories available
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Batches
                </span>
                <span className="font-semibold">{batches?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Items Processed
                </span>
                <span className="font-semibold">
                  {batches?.reduce((sum, b) => sum + b.totalItems, 0) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Days with Scans
                </span>
                <span className="font-semibold">
                  {scanDates?.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Factories
                </span>
                <span className="font-semibold">
                  {factories?.length || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── DAILY REPORT VIEWER DIALOG ── */}
      <Dialog
        open={!!viewingDate}
        onOpenChange={(open) => {
          if (!open) {
            setViewingDate(null);
            setViewingDateFactory(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                Daily Scan Report — {viewingDate ? formatDate(viewingDate) : ""}
              </DialogTitle>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!viewingDate) return;
                    const factoryParam = viewingDateFactory ? `?factory=${viewingDateFactory}` : "";
                    window.open(`/api/scan-dates/${viewingDate}/barcodes${factoryParam}`, "_blank");
                  }}
                >
                  <Barcode className="w-4 h-4 mr-1" />
                  Barcodes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadDateReportFromViewer}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF Report
                </Button>
              </div>
            </div>
          </DialogHeader>

          {dateReportLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : dateReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center col-span-2 sm:col-span-1">
                  <p className="text-xs text-muted-foreground">Factory</p>
                  <p className="font-semibold text-sm">
                    {dateReport.factoryName}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-semibold text-sm">
                    {formatDate(dateReport.date)}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Total Scans</p>
                  <p className="font-semibold text-lg">
                    {dateReport.totalScans}
                  </p>
                </div>
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Scanned IN</p>
                  <p className="font-semibold text-lg text-green-600">
                    {dateReport.inCount}
                  </p>
                </div>
                <div className="bg-blue-500/10 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Scanned OUT</p>
                  <p className="font-semibold text-lg text-blue-600">
                    {dateReport.outCount}
                  </p>
                </div>
              </div>

              {dateReport.items.some((i) => i.duplicate) && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-lg p-3 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {dateReport.items.filter((i) => i.duplicate).length} duplicate
                  garment(s) detected
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Garment ID</TableHead>
                      <TableHead>Type / Size</TableHead>
                      <TableHead>Dir</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Scanned By</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateReport.items.map((item, idx) => (
                      <TableRow
                        key={idx}
                        className={
                          item.duplicate
                            ? "bg-red-50 dark:bg-red-950/20"
                            : ""
                        }
                      >
                        <TableCell className="text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.garmentId}
                        </TableCell>
                        <TableCell>
                          {item.garmentType} / {item.size}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              item.direction === "IN"
                                ? "bg-green-500/10 text-green-600 border-green-500/20"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                            }
                          >
                            {item.direction}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell className="font-medium">
                          {item.scannedBy}
                        </TableCell>
                        <TableCell>{fmtTime(item.scannedAt)}</TableCell>
                        <TableCell>
                          {item.duplicate && (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                            >
                              DUPLICATE
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── BATCH REPORT VIEWER DIALOG ── */}
      <Dialog
        open={!!viewingBatchId}
        onOpenChange={(open) => {
          if (!open) setViewingBatchId(null);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">
                Batch Report — {batchReport?.batchNumber || ""}
              </DialogTitle>
              <div className="flex items-center gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => viewingBatchId && window.open(`/api/batches/${viewingBatchId}/barcodes`, "_blank")}
                >
                  <Barcode className="w-4 h-4 mr-1" />
                  Barcodes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    viewingBatchId && handleDownloadBatchReport(viewingBatchId)
                  }
                >
                  <Download className="w-4 h-4 mr-1" />
                  PDF Report
                </Button>
              </div>
            </div>
          </DialogHeader>

          {batchReportLoading ? (
            <div className="space-y-3 py-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : batchReport ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Factory</p>
                  <p className="font-semibold text-sm">
                    {batchReport.factoryName} ({batchReport.factoryCode})
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Scanned By</p>
                  <p className="font-semibold text-sm">
                    {batchReport.scannedBy}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Direction</p>
                  <p className="font-semibold text-sm">
                    {batchReport.direction === "IN"
                      ? "Scan IN"
                      : "Scan OUT"}{" "}
                    @ {batchReport.location}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Total Items</p>
                  <p className="font-semibold text-lg">
                    {batchReport.totalItems}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-semibold text-sm">
                    {fmtDateTime(batchReport.createdAt)}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="font-semibold text-sm">
                    {batchReport.completedAt
                      ? fmtDateTime(batchReport.completedAt)
                      : "Pending"}
                  </p>
                </div>
              </div>

              {batchReport.items.some((i) => i.duplicate) && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-lg p-3 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {batchReport.items.filter((i) => i.duplicate).length}{" "}
                  duplicate garment(s) detected
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Garment ID</TableHead>
                      <TableHead>Type / Size</TableHead>
                      <TableHead>Scanned By</TableHead>
                      <TableHead>Scan Time</TableHead>
                      <TableHead>Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchReport.items.map((item, idx) => (
                      <TableRow
                        key={idx}
                        className={
                          item.duplicate
                            ? "bg-red-50 dark:bg-red-950/20"
                            : ""
                        }
                      >
                        <TableCell className="text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.garmentId}
                        </TableCell>
                        <TableCell>
                          {item.garmentType} / {item.size}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.scannedBy}
                        </TableCell>
                        <TableCell>
                          {fmtDateTime(item.scannedAt)}
                        </TableCell>
                        <TableCell>
                          {item.duplicate && (
                            <Badge
                              variant="destructive"
                              className="text-xs"
                            >
                              DUPLICATE
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
