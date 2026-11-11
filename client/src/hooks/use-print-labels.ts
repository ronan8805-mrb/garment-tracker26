import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { printLabels } from "@/lib/labels";

/** Print labels from a barcode endpoint, with progress and result messages */
export function usePrintLabels() {
  const { toast } = useToast();
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  const print = async (baseUrl: string, key: string = baseUrl) => {
    setPrintingKey(key);
    const progress: { toast?: ReturnType<typeof toast> } = {};
    try {
      const result = await printLabels(baseUrl, (done, total) => {
        if (total <= 1) return;
        const title = `Printing labels… ${done} of ${total}`;
        if (progress.toast) progress.toast.update({ id: progress.toast.id, title });
        else progress.toast = toast({ title });
      });
      if (result && result.printed > 0) {
        toast({
          title: `Sent ${result.printed} label${result.printed === 1 ? "" : "s"} to the printer`,
          description: result.printer,
        });
      } else {
        progress.toast?.dismiss();
      }
    } catch (err: any) {
      progress.toast?.dismiss();
      toast({ title: "Can't print labels", description: err?.message, variant: "destructive" });
    } finally {
      setPrintingKey(null);
    }
  };

  return { printingKey, print };
}
