import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Factory, ScanBatch } from "@shared/schema";

interface ScanDate {
  date: string;
  count: number;
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFactory, setFilterFactory] = useState<string>("all");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const { isAdminSession } = useAuth();

  const { data: factories } = useQuery<Factory[]>({
    queryKey: ["/api/factories"],
  });

  const { data: batches, isLoading: batchesLoading } = useQuery<ScanBatch[]>({
    queryKey: ["/api/batches"],
  });

  const { data: scanDates, isLoading: datesLoading } = useQuery<ScanDate[]>({
    queryKey: ["/api/scan-dates"],
  });

  const filteredBatches = batches?.filter((b) => {
    const matchesSearch = b.batchNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFactory = filterFactory === "all" || b.factoryId === filterFactory;
    const matchesDirection = filterDirection === "all" || b.direction === filterDirection;
    return matchesSearch && matchesFactory && matchesDirection;
  });

  const getFactoryName = (factoryId: string) => {
    return factories?.find((f) => f.id === factoryId)?.name || "Unknown";
  };

  const handleDownloadReport = (batchId: string) => {
    window.open(`/api/batches/${batchId}/report`, "_blank");
  };

  const handleDownloadDateReport = (date: string) => {
    window.open(`/api/scan-dates/${date}/report`, "_blank");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Garment Reports</h1>
          <p className="text-muted-foreground">View scan history by date and download PDF reports</p>
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

            <TabsContent value="dates">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Daily Scan Reports</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Click download to get a PDF of all garments scanned on that date
                  </p>
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
                            <TableHead>Total Scans</TableHead>
                            <TableHead className="text-right">Report</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scanDates.map((sd) => (
                            <TableRow
                              key={sd.date}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleDownloadDateReport(sd.date)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                                    <Calendar className="w-5 h-5 text-primary" />
                                  </div>
                                  <div>
                                    <span className="font-medium">{formatDate(sd.date)}</span>
                                    <p className="text-xs text-muted-foreground">{sd.date}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-sm">
                                  {sd.count} scans
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
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
                        Scan garments to see daily reports here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="batches">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Batch Reports</CardTitle>
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search batches..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {isAdminSession && (
                      <Select value={filterFactory} onValueChange={setFilterFactory}>
                        <SelectTrigger className="w-[160px]">
                          <Building2 className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Factory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Factories</SelectItem>
                          {factories?.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Select value={filterDirection} onValueChange={setFilterDirection}>
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
                                  <span className="font-medium">{batch.batchNumber}</span>
                                </div>
                              </TableCell>
                              <TableCell>{getFactoryName(batch.factoryId)}</TableCell>
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
                                <span className="font-medium">{batch.totalItems}</span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {batch.createdAt
                                  ? new Date(batch.createdAt).toLocaleDateString()
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadReport(batch.id)}
                                >
                                  <Download className="w-4 h-4 mr-1" />
                                  PDF
                                </Button>
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
                      <h3 className="font-semibold text-lg mb-1">No batches found</h3>
                      <p className="text-muted-foreground">
                        {searchQuery || filterFactory !== "all" || filterDirection !== "all"
                          ? "Try adjusting your filters"
                          : "Complete a scan batch to see it here"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          {isAdminSession && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Barcode Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Download barcode sheets for all garments assigned to a factory.
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
                <span className="text-sm text-muted-foreground">Total Batches</span>
                <span className="font-semibold">{batches?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Items Processed</span>
                <span className="font-semibold">
                  {batches?.reduce((sum, b) => sum + b.totalItems, 0) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Days with Scans</span>
                <span className="font-semibold">{scanDates?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Factories</span>
                <span className="font-semibold">{factories?.length || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
