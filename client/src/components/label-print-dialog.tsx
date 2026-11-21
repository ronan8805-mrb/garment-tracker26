import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, AlertTriangle } from "lucide-react";
import { onLabelPrintRequest, type LabelPrintChoice, type LabelPrintRequest } from "@/lib/labels";

/**
 * "Which labels?" box for the Windows app: one test label (no real number on
 * it), all of them, a range (e.g. 6 to 50 to finish a run that stopped), or
 * only the ones never printed. Warns when labels were printed before, because
 * printing a label twice puts the same number on two jackets. Mounted once in App.
 */
const whenPrinted = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : "before";
export function LabelPrintDialogHost() {
  const [request, setRequest] = useState<LabelPrintRequest | null>(null);
  const [from, setFrom] = useState("1");
  const [to, setTo] = useState("1");

  useEffect(
    () =>
      onLabelPrintRequest((req) => {
        setFrom("1");
        setTo(String(req.count));
        setRequest(req);
      }),
    [],
  );

  const close = (choice: LabelPrintChoice | null) => {
    request?.answer(choice);
    setRequest(null);
  };

  const count = request?.count ?? 0;
  const ids = request?.ids ?? [];
  const f = Math.floor(Number(from));
  const t = Math.floor(Number(to));
  const rangeOk = Number.isFinite(f) && Number.isFinite(t) && f >= 1 && t >= f && t <= count;
  const amount = rangeOk ? t - f + 1 : 0;
  const isAll = rangeOk && f === 1 && t === count;

  const history = request?.printedBefore ?? {};
  const printedIds = ids.filter((id) => history[id]);
  const newCount = count - printedIds.length;
  const rangeReprints = rangeOk ? ids.slice(f - 1, t).filter((id) => history[id]).length : 0;
  const lastPrinted = printedIds
    .map((id) => history[id].lastAt)
    .filter((d): d is string => !!d)
    .sort()
    .pop() ?? null;

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && close(null)}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Print {count} label{count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Printer: <span className="font-medium text-foreground">{request?.printer}</span>
            {" "}— just loaded a new roll? Print a test label first: it has no garment number, so it can't make a duplicate.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {count > 1 && (
          <div className="space-y-2">
            <div className="flex items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="label-from" className="text-xs">From label</Label>
                <Input
                  id="label-from"
                  type="number"
                  min={1}
                  max={count}
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-24"
                  data-testid="input-label-from"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="label-to" className="text-xs">To label</Label>
                <Input
                  id="label-to"
                  type="number"
                  min={1}
                  max={count}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-24"
                  data-testid="input-label-to"
                />
              </div>
              <span className="text-sm text-muted-foreground pb-2">of {count}</span>
            </div>
            <p className="text-xs text-muted-foreground break-all">
              {rangeOk
                ? <>Starts with <span className="font-mono">{ids[f - 1]}</span>{amount > 1 && <>, ends with <span className="font-mono">{ids[t - 1]}</span></>}</>
                : <>Choose labels between 1 and {count}.</>}
            </p>
          </div>
        )}

        {printedIds.length > 0 && (
          <div
            className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            data-testid="label-reprint-warning"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium">
                {count === 1
                  ? `This label was already printed (${whenPrinted(lastPrinted)}).`
                  : `${printedIds.length} of these ${count} labels were already printed (last ${whenPrinted(lastPrinted)}).`}
              </p>
              <p className="text-muted-foreground">
                Printing a label again puts the same number on two jackets. Only reprint one if the first copy was
                spoiled and thrown away.
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:flex-wrap sm:space-x-0">
          <AlertDialogCancel onClick={() => close(null)} data-testid="button-label-print-cancel">
            Cancel
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => close({ test: true })}
            title="Prints a label marked TEST with no garment number, to check the printer"
            data-testid="button-label-print-test"
          >
            Print test label (no number)
          </Button>
          {printedIds.length > 0 && newCount > 0 && (
            <Button onClick={() => close({ onlyNew: true })} data-testid="button-label-print-new">
              <Printer className="w-4 h-4 mr-1" />
              Print the {newCount} not printed yet
            </Button>
          )}
          <Button
            variant={rangeReprints > 0 ? "destructive" : "default"}
            disabled={count > 1 && !rangeOk}
            onClick={() => close(count === 1 ? { from: 1, to: 1 } : { from: f, to: t })}
            data-testid="button-label-print-all"
          >
            <Printer className="w-4 h-4 mr-1" />
            {rangeReprints > 0
              ? `Print again anyway (${count === 1 ? 1 : amount})`
              : count === 1
                ? "Print label"
                : isAll
                  ? `Print all ${count}`
                  : `Print ${amount} (${f}–${t})`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
