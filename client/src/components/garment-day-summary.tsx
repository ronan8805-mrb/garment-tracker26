import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { DeleteWithPasswordDialog } from "@/components/delete-with-password";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, ArrowUpFromLine, Ban, Building2, CalendarDays, Shirt, WashingMachine } from "lucide-react";
import type { Factory } from "@shared/schema";

interface ScanDate {
  date: string;
  count: number;
}

interface Group {
  type: string;
  colour: string | null;
  total: number;
  sizes: Record<string, number>;
  garments: { garmentId: string; size: string; status: string; blocked?: boolean }[];
}

interface Section {
  location: string;
  direction: string;
  total: number;
  groups: Group[];
}

interface DaySummary {
  date: string;
  sections: Section[];
  receivedAtLaundry: number;
  stillAtLaundry: number;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 99 : i;
};

// Box colours that look like the garment colour
const COLOUR_STYLE: Record<string, string> = {
  white: "bg-white text-slate-900 border-slate-300",
  red: "bg-red-600 text-white border-red-700",
  green: "bg-green-600 text-white border-green-700",
  grey: "bg-gray-500 text-white border-gray-600",
  gray: "bg-gray-500 text-white border-gray-600",
};
const boxStyle = (colour: string | null) =>
  (colour && COLOUR_STYLE[colour.toLowerCase()]) || "bg-muted text-foreground border-border";

const sectionTitle = (s: Section) => {
  if (s.location === "laundry" && s.direction === "IN") return "Received at laundry (IN)";
  if (s.location === "laundry" && s.direction === "OUT") return "Sent back from laundry (OUT)";
  if (s.location === "factory" && s.direction === "OUT") return "Sent from factory (OUT)";
  return "Received back at factory (IN)";
};

const groupName = (g: Group) => (g.colour ? `${g.colour} ${g.type}` : g.type);

const formatDay = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-IE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

const sortedSizes = (sizes: Record<string, number>) =>
  Object.entries(sizes).sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]) || a[0].localeCompare(b[0]));

/**
 * "By Garment" report: pick a day and see what was handled, IN and OUT
 * separately, as one coloured box per garment type and colour. Tap a box for
 * the sizes and garment numbers.
 */
export function GarmentDaySummary({ isAdmin, factories }: { isAdmin: boolean; factories?: Factory[] }) {
  const [factory, setFactory] = useState("all");
  const [date, setDate] = useState<string>("");
  const [open, setOpen] = useState<{ section: Section; group: Group } | null>(null);
  const { toast } = useToast();
  // "Only these are real": block every other label of a colour
  const [blocking, setBlocking] = useState<{ colour: string; keep: number } | null>(null);
  const [preview, setPreview] = useState<{ keep: number; block: { garmentId: string; garmentType: string; size: string }[] } | null>(null);
  useEffect(() => {
    setPreview(null);
    if (!blocking || !date) return;
    apiRequest("POST", "/api/garments/block-others/preview", {
      date,
      colour: blocking.colour,
      ...(factory !== "all" ? { factoryId: factory } : {}),
    })
      .then(setPreview)
      .catch(() => setPreview({ keep: blocking.keep, block: [] }));
  }, [blocking, date, factory]);
  const previewBySize = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of preview?.block ?? []) m[`${g.size} ${g.garmentType}`] = (m[`${g.size} ${g.garmentType}`] ?? 0) + 1;
    return Object.entries(m).sort((a, b) => sizeRank(a[0].split(" ")[0]) - sizeRank(b[0].split(" ")[0]));
  }, [preview]);

  const factoryParam = isAdmin && factory !== "all" ? `?factory=${factory}` : "";
  const { data: dates, isLoading: datesLoading } = useQuery<ScanDate[]>({
    queryKey: [`/api/scan-dates${factoryParam}`],
  });

  // Default to the most recent day
  useEffect(() => {
    if (dates && dates.length && !dates.some((d) => d.date === date)) setDate(dates[0].date);
  }, [dates, date]);

  const { data: summary, isLoading } = useQuery<DaySummary>({
    queryKey: [`/api/scan-dates/${date}/summary${factoryParam}`],
    enabled: !!date,
  });

  const laundryOut = useMemo(
    () => summary?.sections.find((s) => s.location === "laundry" && s.direction === "OUT")?.total ?? 0,
    [summary],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Garments by day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Select value={factory} onValueChange={setFactory}>
                <SelectTrigger className="w-[200px]" data-testid="select-summary-factory">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="All Factories" />
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
            <Select value={date} onValueChange={setDate} disabled={!dates?.length}>
              <SelectTrigger className="w-[270px]" data-testid="select-summary-date">
                <CalendarDays className="w-4 h-4 mr-2" />
                <SelectValue placeholder={datesLoading ? "Loading…" : "No scans yet"} />
              </SelectTrigger>
              <SelectContent>
                {dates?.map((d) => (
                  <SelectItem key={d.date} value={d.date}>
                    {formatDay(d.date)} — {d.count} scans
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {date && (isLoading || !summary) ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <ArrowDownToLine className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-summary-in">{summary.receivedAtLaundry}</p>
                  <p className="text-xs text-muted-foreground">Received at laundry</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <ArrowUpFromLine className="w-6 h-6 text-primary" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-summary-out">{laundryOut}</p>
                  <p className="text-xs text-muted-foreground">Sent back from laundry</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <WashingMachine className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-summary-still">{summary.stillAtLaundry}</p>
                  <p className="text-xs text-muted-foreground">Of that day's IN, still at the laundry now</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {summary.sections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No scans on this day.</p>
          ) : (
            summary.sections.map((section) => (
              <Card key={`${section.location}:${section.direction}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>{sectionTitle(section)}</span>
                    <Badge variant="secondary">{section.total} garments</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                    {section.groups.map((group) => (
                      <button
                        key={`${group.type}|${group.colour}`}
                        type="button"
                        onClick={() => setOpen({ section, group })}
                        className={`rounded-lg border-2 p-3 text-left transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary ${boxStyle(group.colour)}`}
                        data-testid={`box-${section.direction}-${group.colour ?? "none"}-${group.type}`}
                      >
                        <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide opacity-90">
                          <Shirt className="w-3.5 h-3.5" />
                          {group.colour ?? "No colour"}
                        </div>
                        <div className="text-sm font-medium mt-0.5">{group.type}</div>
                        <div className="text-3xl font-bold leading-tight mt-1">{group.total}</div>
                        <div className="text-[11px] mt-1 opacity-90">
                          {sortedSizes(group.sizes)
                            .map(([size, n]) => `${size} ${n}`)
                            .join(" · ")}
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </>
      ) : null}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {groupName(open.group)} — {open.group.total}
                </DialogTitle>
                <DialogDescription>
                  {sectionTitle(open.section)}, {formatDay(date)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                {sortedSizes(open.group.sizes).map(([size, n]) => (
                  <Badge key={size} variant="outline" className="text-sm">
                    {size}: {n}
                  </Badge>
                ))}
              </div>
              <div className="border rounded-md divide-y">
                {[...open.group.garments]
                  .sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.garmentId.localeCompare(b.garmentId, undefined, { numeric: true }))
                  .map((g) => (
                  <div key={g.garmentId} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-mono">{g.garmentId}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{g.size}</Badge>
                      {g.blocked ? (
                        <Badge variant="destructive">Blocked</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {g.status === "at_laundry" ? "At laundry" : "At factory"}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {isAdmin &&
                open.section.location === "laundry" &&
                open.section.direction === "IN" &&
                open.group.colour && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="text-sm">
                      Are the {open.group.colour.toLowerCase()} items received here the only real{" "}
                      {open.group.colour.toLowerCase()} ones? Block every other {open.group.colour.toLowerCase()} label,
                      so scanning one says to change the label.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      data-testid="button-block-other-labels"
                      onClick={() => {
                        const colour = open.group.colour!;
                        const keep = open.section.groups
                          .filter((g) => g.colour === colour)
                          .reduce((n, g) => n + g.total, 0);
                        setOpen(null);
                        setBlocking({ colour, keep });
                      }}
                    >
                      <Ban className="w-4 h-4 mr-2" />
                      Keep only these: block every other {open.group.colour} label
                    </Button>
                  </div>
                )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <DeleteWithPasswordDialog
        open={!!blocking}
        onOpenChange={(o) => !o && setBlocking(null)}
        tone="destructive"
        icon={<Ban className="w-5 h-5" />}
        title={blocking ? `Block other ${blocking.colour} labels` : ""}
        confirmLabel={preview ? `Block ${preview.block.length} labels` : "Block labels"}
        busyLabel="Blocking…"
        description={
          <>
            <p>
              Keep the <strong>{preview?.keep ?? blocking?.keep ?? 0}</strong> {blocking?.colour.toLowerCase()} items
              received at the laundry on {date ? formatDay(date) : ""}.
            </p>
            {!preview ? (
              <p>Working out which labels…</p>
            ) : preview.block.length === 0 ? (
              <p>There are no other {blocking?.colour.toLowerCase()} labels to block.</p>
            ) : (
              <>
                <p>
                  Block the other <strong>{preview.block.length}</strong> {blocking?.colour.toLowerCase()} labels:
                </p>
                <ul className="list-disc pl-5">
                  {previewBySize.map(([k, n]) => (
                    <li key={k}>
                      {k}: {n}
                    </li>
                  ))}
                </ul>
                <p>
                  When one of these is scanned the app says <strong>CHANGE THE LABEL</strong> and doesn't count it.
                  Nothing is deleted, and a label can be unblocked from Garments (pencil).
                </p>
              </>
            )}
          </>
        }
        onConfirm={async (password) => {
          if (!blocking) return;
          const result = await apiRequest("POST", "/api/garments/block-others", {
            password,
            date,
            colour: blocking.colour,
            ...(factory !== "all" ? { factoryId: factory } : {}),
          });
          queryClient.invalidateQueries();
          toast({
            title: `${result.blocked} ${blocking.colour.toLowerCase()} labels blocked`,
            description: `Only the ${result.kept} ${blocking.colour.toLowerCase()} items received on ${formatDay(date)} count now.`,
          });
        }}
      />
    </div>
  );
}
