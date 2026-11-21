import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Garment } from "@shared/schema";

const NO_COLOUR = "__none";

/**
 * Correct what the system records for a garment (type, size, colour), for
 * example labels made as "Coverall" that went on jackets. The printed label and
 * its number stay the same. Optionally applies to every label from the same lot.
 */
export function EditGarmentDialog({
  garment,
  lotSize,
  types,
  sizes,
  colours,
  onClose,
}: {
  garment: Garment | null;
  /** How many labels were made in the same go as this one */
  lotSize: number;
  types: string[];
  sizes: string[];
  colours: string[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState("");
  const [size, setSize] = useState("");
  const [colour, setColour] = useState(NO_COLOUR);
  const [wholeLot, setWholeLot] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!garment) return;
    setType(garment.garmentType);
    setSize(garment.size);
    setColour(garment.colour || NO_COLOUR);
    setWholeLot(lotSize > 1);
  }, [garment, lotSize]);

  if (!garment) return null;
  const typeOptions = types.includes(garment.garmentType) ? types : [garment.garmentType, ...types];
  const sizeOptions = sizes.includes(garment.size) ? sizes : [garment.size, ...sizes];
  const changed =
    type !== garment.garmentType || size !== garment.size || (colour === NO_COLOUR ? null : colour) !== (garment.colour || null);
  const count = wholeLot ? lotSize : 1;

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = { wholeLot };
      if (type !== garment.garmentType) body.garmentType = type;
      if (size !== garment.size) body.size = size;
      if ((colour === NO_COLOUR ? null : colour) !== (garment.colour || null)) body.colour = colour === NO_COLOUR ? null : colour;
      const result = await apiRequest("PATCH", `/api/garments/${garment.id}`, body);
      await queryClient.invalidateQueries();
      toast({
        title: "Garment details saved",
        description: `${result.updated} label${result.updated === 1 ? "" : "s"} now recorded as ${size} ${colour === NO_COLOUR ? "" : colour + " "}${type}.`,
      });
      onClose();
    } catch (error: any) {
      let message: string = error?.message || "Could not save";
      const json = message.indexOf("{");
      if (json !== -1) {
        try {
          message = JSON.parse(message.slice(json)).message || message;
        } catch {}
      }
      toast({ title: "Not saved", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!garment} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            Change garment details
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <p>
                <code className="font-mono text-foreground break-all">{garment.garmentId}</code>
              </p>
              <p>
                This only changes what the system records. The label on the jacket and its number stay the same, so
                nothing needs reprinting.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger data-testid="select-edit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Size</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger data-testid="select-edit-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizeOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Colour</Label>
            <Select value={colour} onValueChange={setColour}>
              <SelectTrigger data-testid="select-edit-colour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COLOUR}>None</SelectItem>
                {colours.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {lotSize > 1 && (
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={wholeLot}
              onCheckedChange={(v) => setWholeLot(v === true)}
              data-testid="checkbox-edit-whole-lot"
            />
            <span>
              Change all {lotSize} labels made with this one (numbers{" "}
              <code className="font-mono">{garment.garmentId.replace(/-\d+$/, "-…")}</code>)
            </span>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!changed || busy} data-testid="button-edit-garment-save">
            {busy ? "Saving…" : `Save ${count} label${count === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
