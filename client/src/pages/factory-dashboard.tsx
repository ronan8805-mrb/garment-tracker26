import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Factory,
  Shirt,
  ScanLine,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
} from "lucide-react";
import { Link } from "wouter";
import type { Garment, ScanBatch } from "@shared/schema";

interface FactoryDashboardStats {
  factoryName: string;
  totalGarments: number;
  atFactory: number;
  atLaundry: number;
  recentBatches: ScanBatch[];
}

export default function FactoryDashboard() {
  const { data: stats, isLoading } = useQuery<FactoryDashboardStats>({
    queryKey: ["/api/dashboard/factory"],
  });

  if (isLoading) {
    return <FactoryDashboardSkeleton />;
  }

  const atFactoryPercentage = stats?.totalGarments
    ? Math.round((stats.atFactory / stats.totalGarments) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{stats?.factoryName || "Factory"} Dashboard</h1>
          <p className="text-muted-foreground">Your garment overview and recent activity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild data-testid="button-receive-garments">
            <Link href="/scan?direction=IN">
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Receive
            </Link>
          </Button>
          <Button asChild data-testid="button-send-garments">
            <Link href="/scan?direction=OUT">
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Send to Laundry
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shirt className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{stats?.totalGarments || 0}</p>
            <p className="text-sm font-medium text-muted-foreground">Total Garments</p>
            <p className="text-xs text-muted-foreground">Assigned to your factory</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Factory className="w-6 h-6 text-blue-500" />
              </div>
              <Badge variant="secondary">{atFactoryPercentage}%</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.atFactory || 0}</p>
            <p className="text-sm font-medium text-muted-foreground">At Factory</p>
            <p className="text-xs text-muted-foreground">Ready to send</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ScanLine className="w-6 h-6 text-green-500" />
              </div>
              <Badge variant="secondary">{100 - atFactoryPercentage}%</Badge>
            </div>
            <p className="text-3xl font-bold">{stats?.atLaundry || 0}</p>
            <p className="text-sm font-medium text-muted-foreground">At Laundry</p>
            <p className="text-xs text-muted-foreground">Being cleaned</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Garment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">At Factory</span>
                  <span className="text-sm text-muted-foreground">{atFactoryPercentage}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${atFactoryPercentage}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">At Laundry</span>
                  <span className="text-sm text-muted-foreground">{100 - atFactoryPercentage}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-500"
                    style={{ width: `${100 - atFactoryPercentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <Button variant="outline" className="w-full" asChild>
                <Link href="/garments">View All Garments</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentBatches && stats.recentBatches.length > 0 ? (
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {stats.recentBatches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${
                          batch.direction === "IN"
                            ? "bg-green-500/10"
                            : "bg-blue-500/10"
                        }`}>
                          {batch.direction === "IN" ? (
                            <ArrowDownToLine className="w-5 h-5 text-green-500" />
                          ) : (
                            <ArrowUpFromLine className="w-5 h-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{batch.batchNumber}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {batch.createdAt
                              ? new Date(batch.createdAt).toLocaleString()
                              : "Unknown"}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-sm">{batch.totalItems}</p>
                        <p className="text-xs text-muted-foreground">items</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ScanLine className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium">No recent activity</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Start scanning to track garments
                </p>
                <Button size="sm" asChild>
                  <Link href="/scan">Start Scanning</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FactoryDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg mb-4" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
