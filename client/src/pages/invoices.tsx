import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Plus,
  Trash2,
  Pencil,
  Eye,
  Download,
  Building2,
  Receipt,
  CheckSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Factory, ScanBatch, Invoice, InvoiceLine } from "@shared/schema";

interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[];
  factoryName?: string;
}

interface EditableLine {
  batchId: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
}

const fmt = (cents: number) => `€${(cents / 100).toFixed(2)}`;
const fmtDate = (d: string | Date | null) => {
  if (!d) return "-";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const toInputDate = (d: string | Date | null) => {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().split("T")[0];
};

export default function InvoicesPage() {
  const { toast } = useToast();

  const [selectedFactory, setSelectedFactory] = useState<string>("");
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(new Set());
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithLines | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit form state
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editDeliveryAddress, setEditDeliveryAddress] = useState("");
  const [editInvoiceDate, setEditInvoiceDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editTaxRate, setEditTaxRate] = useState("13.5");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<EditableLine[]>([]);

  const { data: factories } = useQuery<Factory[]>({ queryKey: ["/api/factories"] });
  const { data: invoices } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });

  const { data: batches } = useQuery<ScanBatch[]>({
    queryKey: ["/api/batches", selectedFactory],
    queryFn: async () => {
      const url = selectedFactory ? `/api/batches?factory=${selectedFactory}` : "/api/batches";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch batches");
      return res.json();
    },
    enabled: !!selectedFactory,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async () => {
      const factory = factories?.find((f) => f.id === selectedFactory);
      return apiRequest("POST", "/api/invoices", {
        factoryId: selectedFactory,
        batchIds: Array.from(selectedBatches),
        customerName: factory?.name || "",
        customerAddress: factory?.location || "",
        unitPrice: 0.80,
        taxRate: "13.5",
      });
    },
    onSuccess: (data: InvoiceWithLines) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSelectedBatches(new Set());
      toast({ title: "Invoice created", description: `${data.invoiceNumber} ready for review` });
      openEditor(data);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!editingInvoice) return;
      return apiRequest("PUT", `/api/invoices/${editingInvoice.id}`, {
        customerName: editCustomerName,
        customerAddress: editCustomerAddress,
        deliveryAddress: editDeliveryAddress,
        invoiceDate: editInvoiceDate,
        dueDate: editDueDate,
        taxRate: editTaxRate,
        notes: editNotes,
        lines: editLines.map((l) => ({
          batchId: l.batchId,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setEditingInvoice(null);
      toast({ title: "Invoice updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDeleteId(null);
      toast({ title: "Invoice deleted" });
    },
  });

  function openEditor(inv: InvoiceWithLines) {
    setEditCustomerName(inv.customerName);
    setEditCustomerAddress(inv.customerAddress || "");
    setEditDeliveryAddress(inv.deliveryAddress || "");
    setEditInvoiceDate(toInputDate(inv.invoiceDate));
    setEditDueDate(toInputDate(inv.dueDate));
    setEditTaxRate(inv.taxRate);
    setEditNotes(inv.notes || "");
    setEditLines(
      inv.lines.map((l) => ({
        batchId: l.batchId,
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: (l.unitPrice / 100).toFixed(2),
      }))
    );
    setEditingInvoice(inv);
  }

  async function handleViewInvoice(id: string) {
    try {
      const res = await fetch(`/api/invoices/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data: InvoiceWithLines = await res.json();
      openEditor(data);
    } catch {
      toast({ title: "Error", description: "Could not load invoice", variant: "destructive" });
    }
  }

  function toggleBatch(batchId: string) {
    setSelectedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  function updateLine(idx: number, field: keyof EditableLine, value: string) {
    setEditLines((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeLine(idx: number) {
    setEditLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLine() {
    setEditLines((prev) => [
      ...prev,
      { batchId: null, description: "", quantity: "0", unitPrice: "0.80" },
    ]);
  }

  const editSubtotal = editLines.reduce((sum, l) => {
    return sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  }, 0);
  const editTax = editSubtotal * (parseFloat(editTaxRate) / 100);
  const editTotal = editSubtotal + editTax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Generate invoices from scan batches</p>
        </div>
      </div>

      {/* Step 1: Select factory & batches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Create Invoice
          </CardTitle>
          <CardDescription>Select a factory and tick the batches to include</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-2 sm:w-64">
              <label className="text-sm font-medium">Factory</label>
              <Select value={selectedFactory} onValueChange={(v) => { setSelectedFactory(v); setSelectedBatches(new Set()); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose factory..." />
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

            <div className="flex items-end">
              <Button
                disabled={selectedBatches.size === 0 || createInvoiceMutation.isPending}
                onClick={() => createInvoiceMutation.mutate()}
              >
                <Receipt className="w-4 h-4 mr-2" />
                Generate Invoice ({selectedBatches.size} batch{selectedBatches.size !== 1 ? "es" : ""})
              </Button>
            </div>
          </div>

          {selectedFactory && batches && batches.length > 0 && (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead>Direction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id} className="cursor-pointer" onClick={() => toggleBatch(b.id)}>
                      <TableCell>
                        <Checkbox
                          checked={selectedBatches.has(b.id)}
                          onCheckedChange={() => toggleBatch(b.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{b.batchNumber}</TableCell>
                      <TableCell>{b.createdAt ? fmtDate(b.createdAt) : "-"}</TableCell>
                      <TableCell className="text-center font-semibold">{b.totalItems}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.direction} @ {b.location}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedFactory && batches && batches.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No batches found for this factory.</p>
          )}
        </CardContent>
      </Card>

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-semibold">{inv.invoiceNumber}</TableCell>
                      <TableCell>{fmtDate(inv.invoiceDate)}</TableCell>
                      <TableCell>{fmtDate(inv.dueDate)}</TableCell>
                      <TableCell>{inv.customerName}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(inv.total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewInvoice(inv.id)} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="View PDF">
                            <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer">
                              <Eye className="w-4 h-4" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(inv.id)} title="Delete">
                            <Trash2 className="w-4 h-4" />
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
              <Receipt className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-muted-foreground">No invoices yet</p>
              <p className="text-sm text-muted-foreground">Select batches above to generate your first invoice</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editingInvoice} onOpenChange={(open) => { if (!open) setEditingInvoice(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Edit Invoice {editingInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Header fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Name</label>
                <Input value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tax Rate (%)</label>
                <Input value={editTaxRate} onChange={(e) => setEditTaxRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Invoice Date</label>
                <Input type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Customer Address</label>
                <Textarea value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Address</label>
                <Textarea value={editDeliveryAddress} onChange={(e) => setEditDeliveryAddress(e.target.value)} rows={2} />
              </div>
            </div>

            <Separator />

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Line Items</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-3 h-3 mr-1" />
                  Add Line
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-24">Qty</TableHead>
                      <TableHead className="w-28">Unit Price (€)</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editLines.map((line, idx) => {
                      const lineAmt = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            <Input
                              value={line.description}
                              onChange={(e) => updateLine(idx, "description", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(e) => updateLine(idx, "unitPrice", e.target.value)}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            €{lineAmt.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLine(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals preview */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">€{editSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({editTaxRate}%)</span>
                  <span className="font-medium">€{editTax.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-bold">
                  <span>Total</span>
                  <span>€{editTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingInvoice && (
              <Button variant="outline" asChild className="sm:mr-auto">
                <a href={`/api/invoices/${editingInvoice.id}/pdf`} target="_blank" rel="noreferrer">
                  <Eye className="w-4 h-4 mr-2" />
                  View PDF
                </a>
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditingInvoice(null)}>Cancel</Button>
            <Button onClick={() => updateInvoiceMutation.mutate()} disabled={updateInvoiceMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this invoice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteInvoiceMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
