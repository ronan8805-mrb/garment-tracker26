import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownToLine, ArrowUpFromLine, Building2, CalendarDays, Shirt, WashingMachine } from "lucide-react";
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
  garments: { garmentId: string; size: string; status: string }[];
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
                      <span className="text-xs text-muted-foreground">
                        {g.status === "at_laundry" ? "At laundry" : "At factory"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
