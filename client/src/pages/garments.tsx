import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Shirt,
  Plus,
  Search,
  Barcode,
  Download,
  Trash2,
  Factory,
  Building2,
  Filter,
} from "lucide-react";
import type { Factory as FactoryType, Garment } from "@shared/schema";

const bulkGarmentSchema = z.object({
  factoryId: z.string().min(1, "Please select a factory"),
  garments: z.array(
    z.object({
      garmentType: z.string().min(1, "Garment type is required"),
      size: z.string().min(1, "Size is required"),
      quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    })
  ).min(1, "Add at least one garment type"),
});

type BulkGarmentFormData = z.infer<typeof bulkGarmentSchema>;

const GARMENT_TYPES = [
  "Lab Coat",
  "Coverall",
  "Uniform Shirt",
  "Uniform Pants",
  "Safety Vest",
  "Apron",
  "Jacket",
];

const SIZES = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

export default function GarmentsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFactory, setFilterFactory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();
  const { isAdminSession } = useAuth();

  const { data: factories } = useQuery<FactoryType[]>({
    queryKey: ["/api/factories"],
  });

  const { data: garments, isLoading } = useQuery<Garment[]>({
    queryKey: ["/api/garments"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: BulkGarmentFormData) => {
      return apiRequest("POST", "/api/garments/bulk", data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/garments"] });
      setIsCreateOpen(false);
      toast({
        title: "Garments created",
        description: `${response.count} garments have been created with barcodes.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredGarments = garments?.filter((g) => {
    const matchesSearch = g.garmentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.garmentType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFactory = filterFactory === "all" || g.factoryId === filterFactory;
    const matchesStatus = filterStatus === "all" || g.status === filterStatus;
    return matchesSearch && matchesFactory && matchesStatus;
  });

  const getFactoryName = (factoryId: string) => {
    return factories?.find((f) => f.id === factoryId)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Garments</h1>
          <p className="text-muted-foreground">{isAdminSession ? "Manage garments and generate barcodes" : "View your factory's garments"}</p>
        </div>
        {isAdminSession && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-garments">
                <Plus className="w-4 h-4 mr-2" />
                Add Garments
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Garments & Generate Barcodes</DialogTitle>
                <DialogDescription>
                  Add garment types with sizes and quantities. Barcodes will be generated automatically.
                </DialogDescription>
              </DialogHeader>
              <BulkGarmentForm
                factories={factories || []}
                onSubmit={(data) => createMutation.mutate(data)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search garments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-garments"
              />
            </div>
            {isAdminSession && (
              <Select value={filterFactory} onValueChange={setFilterFactory}>
                <SelectTrigger className="w-[180px]" data-testid="select-filter-factory">
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
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]" data-testid="select-filter-status">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="at_factory">At Factory</SelectItem>
                <SelectItem value="at_laundry">At Laundry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredGarments && filteredGarments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Garment ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Factory</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGarments.slice(0, 100).map((garment) => (
                    <TableRow key={garment.id} data-testid={`row-garment-${garment.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Barcode className="w-4 h-4 text-muted-foreground" />
                          <code className="text-sm font-mono">{garment.garmentId}</code>
                        </div>
                      </TableCell>
                      <TableCell>{garment.garmentType}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{garment.size}</Badge>
                      </TableCell>
                      <TableCell>{getFactoryName(garment.factoryId)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={garment.status === "at_factory" ? "default" : "secondary"}
                          className={garment.status === "at_factory" 
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20"
                          }
                        >
                          {garment.status === "at_factory" ? "At Factory" : "At Laundry"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredGarments.length > 100 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-t">
                  Showing 100 of {filteredGarments.length} garments
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Shirt className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No garments found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterFactory !== "all" || filterStatus !== "all"
                  ? "Try adjusting your filters"
                  : isAdminSession 
                    ? "Get started by adding garments to a factory"
                    : "No garments have been assigned to your factory yet"}
              </p>
              {isAdminSession && !searchQuery && filterFactory === "all" && filterStatus === "all" && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Garments
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BulkGarmentForm({
  factories,
  onSubmit,
  isLoading,
}: {
  factories: FactoryType[];
  onSubmit: (data: BulkGarmentFormData) => void;
  isLoading: boolean;
}) {
  const form = useForm<BulkGarmentFormData>({
    resolver: zodResolver(bulkGarmentSchema),
    defaultValues: {
      factoryId: "",
      garments: [{ garmentType: "", size: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "garments",
  });

  const totalQuantity = form.watch("garments").reduce(
    (sum, g) => sum + (Number(g.quantity) || 0),
    0
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="factoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-factory">
                    <SelectValue placeholder="Select a factory" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {factories.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name} ({f.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <FormLabel>Garment Types</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ garmentType: "", size: "", quantity: 1 })}
              data-testid="button-add-row"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Row
            </Button>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <FormField
                    control={form.control}
                    name={`garments.${index}.garmentType`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel className="text-xs">Type</FormLabel>}
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-type-${index}`}>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {GARMENT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`garments.${index}.size`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        {index === 0 && <FormLabel className="text-xs">Size</FormLabel>}
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid={`select-size-${index}`}>
                              <SelectValue placeholder="Size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SIZES.map((size) => (
                              <SelectItem key={size} value={size}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`garments.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-24">
                        {index === 0 && <FormLabel className="text-xs">Qty</FormLabel>}
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            data-testid={`input-quantity-${index}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={index === 0 ? "mt-6" : ""}
                      onClick={() => remove(index)}
                      data-testid={`button-remove-row-${index}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm">
            <span className="text-muted-foreground">Total garments: </span>
            <span className="font-semibold">{totalQuantity}</span>
          </div>
          <Button type="submit" disabled={isLoading} data-testid="button-generate-qr">
            {isLoading ? (
              "Generating..."
            ) : (
              <>
                <Barcode className="w-4 h-4 mr-2" />
                Generate Garments & Barcodes
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
