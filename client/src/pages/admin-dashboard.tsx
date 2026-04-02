import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Factory,
  Shirt,
  ScanLine,
  TrendingUp,
  Building2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Factory as FactoryType, ScanBatch } from "@shared/schema";

interface FactoryBreakdown {
  id: string;
  name: string;
  code: string;
  total: number;
  atFactory: number;
  atLaundry: number;
}

interface DashboardStats {
  totalFactories: number;
  activeFactories: number;
  totalGarments: number;
  atFactory: number;
  atLaundry: number;
  todayScans: number;
  recentBatches: ScanBatch[];
  recentFactories: FactoryType[];
  factoryBreakdown: FactoryBreakdown[];
}

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/admin"],
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your laundry operations</p>
        </div>
        <Button asChild data-testid="button-quick-scan">
          <Link href="/scan">
            <ScanLine className="w-4 h-4 mr-2" />
            Quick Scan
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Factories"
          value={stats?.totalFactories || 0}
          subtitle={`${stats?.activeFactories || 0} active`}
          icon={Building2}
          trend="neutral"
        />
        <StatCard
          title="Total Garments"
          value={stats?.totalGarments || 0}
          subtitle="Tracked in system"
          icon={Shirt}
          trend="up"
        />
        <StatCard
          title="At Factory"
          value={stats?.atFactory || 0}
          subtitle="Currently at factories"
          icon={Factory}
          trend="neutral"
          color="blue"
        />
        <StatCard
          title="At Laundry"
          value={stats?.atLaundry || 0}
          subtitle="Being processed"
          icon={TrendingUp}
          trend="neutral"
          color="green"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-lg">Garments Per Factory</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/factories">
              Manage Factories
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {stats?.factoryBreakdown && stats.factoryBreakdown.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factory</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">At Factory</TableHead>
                    <TableHead className="text-center">At Laundry</TableHead>
                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.factoryBreakdown.map((fb) => {
                    const pct = fb.total > 0 ? Math.round((fb.atFactory / fb.total) * 100) : 0;
                    return (
                      <TableRow key={fb.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/garments?factory=${fb.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-md bg-primary/10 flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-primary underline-offset-4 hover:underline">{fb.name}</p>
                              <p className="text-xs text-muted-foreground">{fb.code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-semibold text-lg">{fb.total}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                            {fb.atFactory}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            {fb.atLaundry}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="w-full max-w-[120px]">
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                              <span>{pct}% factory</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Building2}
              title="No factories yet"
              description="Create your first factory to get started"
              action={
                <Button size="sm" asChild>
                  <Link href="/factories">Add Factory</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg">Recent Batches</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/reports">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {stats?.recentBatches && stats.recentBatches.length > 0 ? (
              <div className="space-y-3">
                {stats.recentBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-accent flex items-center justify-center">
                        <ScanLine className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{batch.batchNumber}</p>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {batch.createdAt
                            ? new Date(batch.createdAt).toLocaleString()
                            : "Unknown"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{batch.totalItems} items</p>
                      <Badge variant="outline" className="text-xs">
                        {batch.direction} @ {batch.location}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={ScanLine}
                title="No batches yet"
                description="Start scanning to create batches"
                action={
                  <Button size="sm" asChild>
                    <Link href="/scan">Start Scanning</Link>
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-lg">Today's Scans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <ScanLine className="w-8 h-8 text-primary" />
              </div>
              <p className="text-4xl font-bold">{stats?.todayScans || 0}</p>
              <p className="text-sm text-muted-foreground mt-1">scans today</p>
              <Button size="sm" variant="outline" className="mt-4" asChild>
                <Link href="/reports">View Reports</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "default",
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: any;
  trend: "up" | "down" | "neutral";
  color?: "default" | "blue" | "green";
}) {
  const colorClasses = {
    default: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
    green: "bg-green-500/10 text-green-500 dark:text-green-400",
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg mb-4" />
              <Skeleton className="h-8 w-20 mb-2" />
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
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
