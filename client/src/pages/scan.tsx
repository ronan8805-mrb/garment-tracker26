import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ScanLine,
  Check,
  X,
  AlertTriangle,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Trash2,
  Building2,
  Factory,
  Bluetooth,
} from "lucide-react";
import type { Factory as FactoryType, Garment, UserProfile } from "@shared/schema";

interface ScannedItem {
  garmentId: string;
  garment?: Garment;
  status: "success" | "error" | "warning";
  message: string;
  timestamp: Date;
}

interface ScanPageProps {
  userProfile: UserProfile | null;
}

export default function ScanPage({ userProfile }: ScanPageProps) {
  const searchParams = useSearch();
  const urlDirection = new URLSearchParams(searchParams).get("direction");
  
  const [location, setLocation] = useState<"factory" | "laundry">(
    userProfile?.role === "factory" ? "factory" : "laundry"
  );
  const [direction, setDirection] = useState<"IN" | "OUT">(
    (urlDirection as "IN" | "OUT") || "IN"
  );
  const [factoryId, setFactoryId] = useState<string>(
    userProfile?.factoryId || ""
  );
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const isAdmin = userProfile?.role === "admin";

  const { data: factories } = useQuery<FactoryType[]>({
    queryKey: ["/api/factories"],
    enabled: isAdmin,
  });

  const scanMutation = useMutation({
    mutationFn: async (garmentCode: string) => {
      return apiRequest("POST", "/api/scan", {
        garmentId: garmentCode,
        location,
        direction,
        factoryId: isAdmin ? factoryId : userProfile?.factoryId,
      });
    },
    onSuccess: (response: any) => {
      const newItem: ScannedItem = {
        garmentId: response.garmentId,
        garment: response.garment,
        status: "success",
        message: `Scanned ${direction} at ${location}`,
        timestamp: new Date(),
      };
      setScannedItems((prev) => [newItem, ...prev]);
      
      const element = document.getElementById("scan-list");
      if (element) {
        element.classList.add("success-flash");
        setTimeout(() => element.classList.remove("success-flash"), 500);
      }
    },
    onError: (error: any) => {
      const newItem: ScannedItem = {
        garmentId: scanInput,
        status: error.message?.includes("duplicate") ? "warning" : "error",
        message: error.message || "Scan failed",
        timestamp: new Date(),
      };
      setScannedItems((prev) => [newItem, ...prev]);
      
      toast({
        title: error.message?.includes("duplicate") ? "Duplicate Scan" : "Scan Error",
        description: error.message,
        variant: error.message?.includes("duplicate") ? "default" : "destructive",
      });
    },
  });

  const completeBatchMutation = useMutation({
    mutationFn: async (generateReport: boolean) => {
      const successfulScans = scannedItems.filter((s) => s.status === "success");
      return apiRequest("POST", "/api/batches", {
        location,
        direction,
        factoryId: isAdmin ? factoryId : userProfile?.factoryId,
        garmentIds: successfulScans.map((s) => s.garmentId),
        generateReport,
      });
    },
    onSuccess: (response: any) => {
      setBatchId(response.batchId);
      queryClient.invalidateQueries({ queryKey: ["/api/garments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      
      toast({
        title: "Batch completed",
        description: `Batch ${response.batchNumber} saved with ${response.totalItems} items.`,
      });
      
      if (response.reportUrl) {
        window.open(response.reportUrl, "_blank");
      }
      
      setScannedItems([]);
      setIsConfirmOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleScan = useCallback((code: string) => {
    if (!code.trim()) return;
    
    const isDuplicate = scannedItems.some(
      (item) => item.garmentId === code && item.status === "success"
    );
    
    if (isDuplicate) {
      const newItem: ScannedItem = {
        garmentId: code,
        status: "warning",
        message: "Already scanned in this batch",
        timestamp: new Date(),
      };
      setScannedItems((prev) => [newItem, ...prev]);
      toast({
        title: "Duplicate scan",
        description: `${code} has already been scanned in this batch.`,
      });
      return;
    }
    
    scanMutation.mutate(code);
  }, [scannedItems, scanMutation, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && scanInput.trim()) {
      e.preventDefault();
      handleScan(scanInput.trim());
      setScanInput("");
    }
  };

  useEffect(() => {
    inputRef.current?.focus();
    
    const handleGlobalClick = () => {
      inputRef.current?.focus();
    };
    
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  const successCount = scannedItems.filter((s) => s.status === "success").length;
  const errorCount = scannedItems.filter((s) => s.status === "error").length;
  const warningCount = scannedItems.filter((s) => s.status === "warning").length;

  const canScan = isAdmin ? !!factoryId : true;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scanning</h1>
          <p className="text-muted-foreground">Scan garments to record movement</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Scan Configuration</CardTitle>
              <CardDescription>Set up your scan session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/50">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Laundry</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Direction</label>
                  <Select
                    value={direction}
                    onValueChange={(v) => setDirection(v as "IN" | "OUT")}
                  >
                    <SelectTrigger data-testid="select-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN">
                        <div className="flex items-center gap-2">
                          <ArrowDownToLine className="w-4 h-4" />
                          Receiving (IN)
                        </div>
                      </SelectItem>
                      <SelectItem value="OUT">
                        <div className="flex items-center gap-2">
                          <ArrowUpFromLine className="w-4 h-4" />
                          Sending (OUT)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Factory</label>
                    <Select value={factoryId} onValueChange={setFactoryId}>
                      <SelectTrigger data-testid="select-factory">
                        <SelectValue placeholder="Select factory" />
                      </SelectTrigger>
                      <SelectContent>
                        {factories?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} ({f.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className={!canScan ? "opacity-50" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ScanLine className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Scan Input
                      <Badge variant="outline" className="flex items-center gap-1 text-xs font-normal">
                        <Bluetooth className="w-3 h-3" />
                        Scanner Ready
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Netum CS7501 Bluetooth scanner supported
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {successCount} scanned
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Input
                ref={inputRef}
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={canScan ? "Scan or type garment ID..." : "Select a factory first"}
                className="text-lg h-14 font-mono"
                disabled={!canScan || scanMutation.isPending}
                autoFocus
                data-testid="input-scan"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Pair your Bluetooth scanner, scan barcode, and it auto-submits. Manual entry: type ID + Enter.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Scanned Items</CardTitle>
                {scannedItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setScannedItems([])}
                    className="text-destructive hover:text-destructive"
                    data-testid="button-clear-scans"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]" id="scan-list">
                {scannedItems.length > 0 ? (
                  <div className="space-y-2">
                    {scannedItems.map((item, index) => (
                      <div
                        key={`${item.garmentId}-${index}`}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          item.status === "success"
                            ? "bg-green-500/10"
                            : item.status === "warning"
                            ? "bg-yellow-500/10"
                            : "bg-red-500/10"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              item.status === "success"
                                ? "bg-green-500/20 text-green-600"
                                : item.status === "warning"
                                ? "bg-yellow-500/20 text-yellow-600"
                                : "bg-red-500/20 text-red-600"
                            }`}
                          >
                            {item.status === "success" ? (
                              <Check className="w-4 h-4" />
                            ) : item.status === "warning" ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <code className="font-mono text-sm font-medium">
                              {item.garmentId}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              {item.message}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {item.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <Package className="w-12 h-12 text-muted-foreground/50 mb-3" />
                    <p className="font-medium text-muted-foreground">No items scanned</p>
                    <p className="text-sm text-muted-foreground">
                      Scan barcodes to add items to this batch
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Batch Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{successCount}</p>
                  <p className="text-xs text-muted-foreground">Success</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium capitalize">{location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direction</span>
                  <span className="font-medium">{direction}</span>
                </div>
                {(factoryId || userProfile?.factoryId) && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Factory</span>
                    <span className="font-medium">
                      {factories?.find((f) => f.id === (factoryId || userProfile?.factoryId))?.name || "Selected"}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  className="w-full"
                  disabled={successCount === 0 || completeBatchMutation.isPending}
                  onClick={() => setIsConfirmOpen(true)}
                  data-testid="button-complete-batch"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Complete Batch
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Batch</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to save a batch of {successCount} garments.
              {direction === "IN" && " These garments will be marked as received."}
              {direction === "OUT" && " These garments will be marked as sent."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => completeBatchMutation.mutate(true)}
              disabled={completeBatchMutation.isPending}
              data-testid="button-save-print"
            >
              <FileText className="w-4 h-4 mr-2" />
              Save & Print Report
            </Button>
            <AlertDialogAction
              onClick={() => completeBatchMutation.mutate(false)}
              disabled={completeBatchMutation.isPending}
              data-testid="button-save-batch"
            >
              Save Batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
