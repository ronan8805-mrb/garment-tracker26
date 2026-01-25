import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, ScanLine, FileText, Shield, Zap, Building2, Stethoscope, Scissors, BadgeCheck, Lock, User } from "lucide-react";

const factoryLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof factoryLoginSchema>>({
    resolver: zodResolver(factoryLoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleFactoryLogin = async (data: z.infer<typeof factoryLoginSchema>) => {
    setIsLoggingIn(true);
    try {
      await apiRequest("POST", "/api/factory/login", data);
      toast({
        title: "Login successful",
        description: "Redirecting to dashboard...",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/factory/session"] });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight">Mr Bubbles</span>
                <span className="text-[10px] text-muted-foreground leading-tight uppercase tracking-wider">Laundry & Linen Specialist</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-login-nav"
              >
                Sign In
              </a>
              <Button asChild data-testid="button-get-started-nav">
                <a href="#login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <BadgeCheck className="w-4 h-4" />
                    <span>ISO 9001 & ISO 45001 Certified</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    Ireland's Leading
                    <span className="block text-primary">Laundry & Linen Specialists</span>
                  </h1>
                  <p className="text-lg sm:text-xl text-muted-foreground max-w-lg">
                    Barcode-driven track-and-trace solution with digital audit system.
                    Fresh, hygienic, and on-time laundry solutions for Ireland's most trusted businesses.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild data-testid="button-get-started-hero">
                    <a href="#login">
                      <ScanLine className="w-5 h-5 mr-2" />
                      Start Tracking
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                    <a href="#features">Learn More</a>
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>HSE & Tusla Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span>Real-time tracking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4 text-primary" />
                    <span>Irish Owned</span>
                  </div>
                </div>
              </div>

              <div className="relative" id="login">
                <Card className="border-2">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl">Sign In to LaundryTrack</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="admin" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="admin" data-testid="tab-admin-login">
                          <Lock className="w-4 h-4 mr-2" />
                          Admin
                        </TabsTrigger>
                        <TabsTrigger value="factory" data-testid="tab-factory-login">
                          <Building2 className="w-4 h-4 mr-2" />
                          Factory
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="admin" className="mt-4">
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleFactoryLogin)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Username</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Enter admin username"
                                        className="pl-9"
                                        {...field}
                                        data-testid="input-admin-username"
                                      />
                                    </div>
                                  </FormControl>
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
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        type="password"
                                        placeholder="Enter admin password"
                                        className="pl-9"
                                        {...field}
                                        data-testid="input-admin-password"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={isLoggingIn}
                              data-testid="button-admin-login"
                            >
                              {isLoggingIn ? "Signing in..." : "Sign In as Admin"}
                            </Button>
                          </form>
                        </Form>
                        <p className="text-xs text-muted-foreground text-center mt-4">
                          Admin access for Mr Bubbles Express staff
                        </p>
                      </TabsContent>
                      <TabsContent value="factory" className="mt-4">
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(handleFactoryLogin)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Username</FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        placeholder="Enter factory username"
                                        className="pl-9"
                                        {...field}
                                        data-testid="input-factory-username"
                                      />
                                    </div>
                                  </FormControl>
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
                                  <FormControl>
                                    <div className="relative">
                                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                      <Input
                                        type="password"
                                        placeholder="Enter factory password"
                                        className="pl-9"
                                        {...field}
                                        data-testid="input-factory-password"
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={isLoggingIn}
                              data-testid="button-factory-login"
                            >
                              {isLoggingIn ? "Signing in..." : "Sign In as Factory"}
                            </Button>
                          </form>
                        </Form>
                        <p className="text-xs text-muted-foreground text-center mt-4">
                          Use the credentials provided by your laundry administrator
                        </p>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl -z-10" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Complete Laundry & Linen Solutions
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Serving hotels, healthcare facilities, restaurants, hair salons, and industrial factories 
                with barcode label tracking and digital audit systems.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={ScanLine}
                title="Barcode Tracking"
                description="Driver app integrated barcode scanning system. Track every garment from pickup to delivery with complete traceability."
              />
              <FeatureCard
                icon={Building2}
                title="Multi-Client Support"
                description="Hotels, healthcare, restaurants, and factories. Each client gets their own secure portal and real-time visibility."
              />
              <FeatureCard
                icon={FileText}
                title="Digital Audit System"
                description="Professional batch reports and documentation. ISO 9001 compliant record-keeping for full accountability."
              />
              <FeatureCard
                icon={Stethoscope}
                title="Healthcare Approved"
                description="HSE-approved processes for medical and healthcare laundry. Sanitisation and stain treatment included."
              />
              <FeatureCard
                icon={Scissors}
                title="Beauty & Salon Services"
                description="Specialised service for towels, robes, gowns, and linens. Fresh, hygienic delivery guaranteed."
              />
              <FeatureCard
                icon={Zap}
                title="Efficient Operations"
                description="Batch processing, duplicate detection, and real-time stock management. Pickup and delivery for businesses."
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Experience Premium Laundry Services?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join Ireland's most trusted businesses with fresh, hygienic, and on-time 
              laundry solutions from Mr Bubbles Express.
            </p>
            <Button size="lg" asChild data-testid="button-get-started-cta">
              <a href="#login">
                Get Started Now
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold">Mr Bubbles Express</span>
            </div>
            <div className="text-sm text-muted-foreground text-center sm:text-right">
              <p>Laundry & Linen Specialist | Drogheda, Co. Louth</p>
              <p>086 270 9299 | info@mrbubblesexpress.com</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>Certified to ISO 9001 & ISO 45001 | Fully Insured | Irish Owned | Reliable | Innovative</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card className="border-0 bg-background/60 backdrop-blur-sm">
      <CardContent className="p-4 text-center">
        {Icon && <Icon className="w-4 h-4 text-primary mx-auto mb-1" />}
        <p className="text-2xl font-bold text-primary">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="font-semibold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
