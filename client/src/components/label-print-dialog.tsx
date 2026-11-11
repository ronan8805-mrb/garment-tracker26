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
import { Printer } from "lucide-react";
import { onLabelPrintRequest, type LabelPrintChoice, type LabelPrintRequest } from "@/lib/labels";

/**
 * "Which labels?" box for the Windows app: one test label, all of them, or a
 * range (e.g. 6 to 50 to finish a run that stopped). Mounted once in App.
 */
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

  return (
    <AlertDialog open={!!request} onOpenChange={(open) => !open && close(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Print {count} label{count === 1 ? "" : "s"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Printer: <span className="font-medium text-foreground">{request?.printer}</span>
            {count > 1 && <> — just loaded a new roll? Print one test label first.</>}
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
            <p className="text-xs text-muted-foreground">
              {rangeOk
                ? <>Starts with <span className="font-mono">{ids[f - 1]}</span>{amount > 1 && <>, ends with <span className="font-mono">{ids[t - 1]}</span></>}</>
                : <>Choose labels between 1 and {count}.</>}
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(null)} data-testid="button-label-print-cancel">
            Cancel
          </AlertDialogCancel>
          {count > 1 && (
            <Button variant="outline" onClick={() => close({ from: 1, to: 1 })} data-testid="button-label-print-test">
              Print 1 test label
            </Button>
          )}
          <Button
            disabled={count > 1 && !rangeOk}
            onClick={() => close(count === 1 ? { from: 1, to: 1 } : { from: f, to: t })}
            data-testid="button-label-print-all"
          >
            <Printer className="w-4 h-4 mr-1" />
            {count === 1 ? "Print label" : isAll ? `Print all ${count}` : `Print ${amount} (${f}–${t})`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
