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
import { Printer } from "lucide-react";
import { onLabelPrintRequest, type LabelPrintRequest } from "@/lib/labels";

/** "Print 1 test label or all of them?" box for the Windows app. Mounted once in App. */
export function LabelPrintDialogHost() {
  const [request, setRequest] = useState<LabelPrintRequest | null>(null);

  useEffect(() => onLabelPrintRequest(setRequest), []);

  const close = (choice: "test" | "all" | null) => {
    request?.answer(choice);
    setRequest(null);
  };

  const count = request?.count ?? 0;

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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(null)} data-testid="button-label-print-cancel">
            Cancel
          </AlertDialogCancel>
          {count > 1 && (
            <Button variant="outline" onClick={() => close("test")} data-testid="button-label-print-test">
              Print 1 test label
            </Button>
          )}
          <Button onClick={() => close("all")} data-testid="button-label-print-all">
            <Printer className="w-4 h-4 mr-1" />
            {count === 1 ? "Print label" : `Print all ${count}`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
