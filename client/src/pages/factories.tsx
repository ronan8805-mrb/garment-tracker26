import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Plus, Search, Shirt, Edit2, Key, Copy, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import type { Factory } from "@shared/schema";

const factoryFormSchema = z.object({
  name: z.string().min(1, "Factory name is required"),
  code: z.string().min(1, "Code is required").max(10, "Code must be 10 characters or less").regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  location: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, numbers, and underscores only"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  isActive: z.boolean().default(true),
});

const editFactoryFormSchema = z.object({
  name: z.string().min(1, "Factory name is required"),
  code: z.string().min(1, "Code is required").max(10, "Code must be 10 characters or less").regex(/^[A-Z0-9]+$/, "Code must be uppercase letters and numbers only"),
  location: z.string().optional(),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-z0-9_]+$/, "Username must be lowercase letters, numbers, and underscores only"),
  password: z.string().optional(),
  isActive: z.boolean().default(true),
});

type FactoryFormData = z.infer<typeof factoryFormSchema>;
type EditFactoryFormData = z.infer<typeof editFactoryFormSchema>;

interface CreatedFactoryCredentials {
  factory: Factory;
  username: string;
  password: string;
}

function generatePassword(length: number = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function FactoriesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<CreatedFactoryCredentials | null>(null);
  const { toast } = useToast();

  const { data: factories, isLoading } = useQuery<Factory[]>({
    queryKey: ["/api/factories"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FactoryFormData) => {
      const response = await apiRequest("POST", "/api/factories", data);
      return response;
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/factories"] });
      setIsCreateOpen(false);
      setCreatedCredentials({
        factory: response,
        username: response.username || "",
        password: response.password || "",
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EditFactoryFormData> }) => {
      return apiRequest("PATCH", `/api/factories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/factories"] });
      setEditingFactory(null);
      toast({
        title: "Factory updated",
        description: "The factory has been updated successfully.",
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

  const filteredFactories = factories?.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Factories</h1>
          <p className="text-muted-foreground">Manage factory profiles and accounts</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-factory">
              <Plus className="w-4 h-4 mr-2" />
              Add Factory
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Factory</DialogTitle>
            </DialogHeader>
            <FactoryForm
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search factories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-factories"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredFactories && filteredFactories.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factory</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFactories.map((factory) => (
                    <TableRow key={factory.id} data-testid={`row-factory-${factory.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <span className="font-medium">{factory.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{factory.code}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {factory.location || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={factory.isActive ? "default" : "secondary"}>
                          {factory.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingFactory(factory)}
                            data-testid={`button-edit-factory-${factory.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/garments?factory=${factory.id}`}>
                              <Shirt className="w-4 h-4 mr-1" />
                              Garments
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-1">No factories found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Get started by creating your first factory"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Factory
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingFactory} onOpenChange={() => setEditingFactory(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Factory</DialogTitle>
          </DialogHeader>
          {editingFactory && (
            <EditFactoryForm
              defaultValues={{
                name: editingFactory.name,
                code: editingFactory.code,
                location: editingFactory.location || undefined,
                username: editingFactory.username || "",
                password: "",
                isActive: editingFactory.isActive,
              }}
              onSubmit={(data) =>
                updateMutation.mutate({ id: editingFactory.id, data })
              }
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdCredentials} onOpenChange={() => setCreatedCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Factory Created Successfully
            </DialogTitle>
          </DialogHeader>
          {createdCredentials && (
            <CredentialsDisplay
              factoryName={createdCredentials.factory.name}
              username={createdCredentials.username}
              password={createdCredentials.password}
              onClose={() => setCreatedCredentials(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FactoryForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: FactoryFormData) => void;
  isLoading: boolean;
}) {
  const form = useForm<FactoryFormData>({
    resolver: zodResolver(factoryFormSchema),
    defaultValues: {
      name: "",
      code: "",
      location: "",
      username: "",
      password: generatePassword(),
      isActive: true,
    },
  });

  const regeneratePassword = () => {
    form.setValue("password", generatePassword());
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Honey Factory"
                  {...field}
                  data-testid="input-factory-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., HF"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  data-testid="input-factory-code"
                />
              </FormControl>
              <FormDescription>Used for garment ID prefixes</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Building A, Industrial Zone"
                  {...field}
                  data-testid="input-factory-location"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <span className="font-medium">Login Credentials</span>
          </div>
          <p className="text-sm text-muted-foreground">
            These credentials will be used by the factory owner to log in and scan garments.
          </p>

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., honey_factory"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    data-testid="input-factory-username"
                  />
                </FormControl>
                <FormDescription>Lowercase letters, numbers, and underscores only</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-factory-password"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={regeneratePassword}
                    title="Generate new password"
                    data-testid="button-regenerate-password"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
                <FormDescription>Share this password with the factory owner</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Inactive factories cannot perform scans
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-factory-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading} data-testid="button-save-factory">
            {isLoading ? "Creating..." : "Create Factory"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function EditFactoryForm({
  defaultValues,
  onSubmit,
  isLoading,
}: {
  defaultValues: Partial<EditFactoryFormData>;
  onSubmit: (data: EditFactoryFormData) => void;
  isLoading: boolean;
}) {
  const form = useForm<EditFactoryFormData>({
    resolver: zodResolver(editFactoryFormSchema),
    defaultValues: {
      name: defaultValues.name || "",
      code: defaultValues.code || "",
      location: defaultValues.location || "",
      username: defaultValues.username || "",
      password: "",
      isActive: defaultValues.isActive ?? true,
    },
  });

  const regeneratePassword = () => {
    form.setValue("password", generatePassword());
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Honey Factory"
                  {...field}
                  data-testid="input-edit-factory-name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Factory Code</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., HF"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  data-testid="input-edit-factory-code"
                />
              </FormControl>
              <FormDescription>Used for garment ID prefixes</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location (Optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Building A, Industrial Zone"
                  {...field}
                  data-testid="input-edit-factory-location"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <span className="font-medium">Login Credentials</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Update the factory login credentials. Leave password blank to keep the current password.
          </p>

          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., honey_factory"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    data-testid="input-edit-factory-username"
                  />
                </FormControl>
                <FormDescription>Lowercase letters, numbers, and underscores only</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password (Optional)</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Leave blank to keep current password"
                      data-testid="input-edit-factory-password"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={regeneratePassword}
                    title="Generate new password"
                    data-testid="button-edit-regenerate-password"
                  >
                    <Key className="w-4 h-4" />
                  </Button>
                </div>
                <FormDescription>Only fill this if you want to change the password</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Inactive factories cannot perform scans
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-edit-factory-active"
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button type="submit" disabled={isLoading} data-testid="button-update-factory">
            {isLoading ? "Saving..." : "Update Factory"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CredentialsDisplay({
  factoryName,
  username,
  password,
  onClose,
}: {
  factoryName: string;
  username: string;
  password: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast({
        title: "Copied",
        description: `${field} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please copy manually",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Key className="h-4 w-4" />
        <AlertTitle>Save these credentials</AlertTitle>
        <AlertDescription>
          Share these login credentials with <strong>{factoryName}</strong>. 
          The password will not be shown again.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-muted/50">
          <div>
            <p className="text-sm text-muted-foreground">Username</p>
            <p className="font-mono font-medium" data-testid="text-created-username">{username}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(username, "Username")}
            data-testid="button-copy-username"
          >
            {copiedField === "Username" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border rounded-lg bg-muted/50">
          <div>
            <p className="text-sm text-muted-foreground">Password</p>
            <p className="font-mono font-medium" data-testid="text-created-password">{password}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => copyToClipboard(password, "Password")}
            data-testid="button-copy-password"
          >
            {copiedField === "Password" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={onClose} data-testid="button-close-credentials">
          Done
        </Button>
      </div>
    </div>
  );
}
