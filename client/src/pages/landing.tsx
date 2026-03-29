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
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Inter', sans-serif" }}>
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: "transparent", borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img
                src="/mr-bubbles-logo.png"
                alt="Mr Bubbles Express - Laundry & Linen Specialist"
                style={{ height: "50px", width: "auto", objectFit: "contain" }}
              />
            </div>
            <div className="flex items-center gap-4">
              <a
                href="#login"
                className="text-sm font-semibold transition-colors"
                style={{ color: "#fff", textShadow: "0 1px 4px rgba(0,80,120,0.4)" }}
                data-testid="link-login-nav"
              >
                Sign In
              </a>
              <a
                href="#login"
                data-testid="button-get-started-nav"
                className="text-sm font-bold px-5 py-2.5 rounded-full transition-all"
                style={{ background: "#fff", color: "#0078a8", boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* No floating bubbles needed - brochure bg has them */}
      <style>{`
        @keyframes bubbleFloat1 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        @keyframes bubbleFloat2 {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(24px) scale(0.97); }
        }
        @keyframes bubbleFloat3 {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-18px); }
        }
        .feature-card-hover {
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .feature-card-hover:hover {
          transform: translateY(-6px);
          box-shadow: 0 16px 40px rgba(0,200,220,0.18);
        }
      `}</style>
      <main style={{ position: "relative", zIndex: 1 }}>
        <section className="px-4 sm:px-6 lg:px-8" style={{ backgroundImage: "url('/mr-bubbles-bg.png')", backgroundSize: "cover", backgroundPosition: "center top", minHeight: "100vh", display: "flex", alignItems: "center", paddingTop: "96px", paddingBottom: "60px" }}>
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.25)", color: "#fff", border: "1px solid rgba(255,255,255,0.5)", backdropFilter: "blur(8px)" }}>
                    <BadgeCheck className="w-4 h-4" />
                    <span>ISO 9001 &amp; ISO 45001 Certified</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight" style={{ color: "#fff", lineHeight: 1.1, textShadow: "0 2px 16px rgba(0,80,130,0.5)" }}>
                    Ireland's Leading
                    <span className="block" style={{ color: "#1a2f6e" }}>Laundry &amp; Linen Specialists</span>
                  </h1>
                  <p className="text-lg sm:text-xl max-w-lg font-medium" style={{ color: "rgba(255,255,255,0.95)", textShadow: "0 1px 6px rgba(0,80,130,0.4)" }}>
                    Barcode-driven track-and-trace solution with digital audit system.
                    Fresh, hygienic, and on-time laundry solutions for Ireland's most trusted businesses.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <a
                    href="#login"
                    data-testid="button-get-started-hero"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-bold text-base transition-all"
                    style={{ background: "#1a3a7a", color: "#fff", boxShadow: "0 4px 24px rgba(0,50,120,0.4)", textDecoration: "none" }}
                  >
                    <ScanLine className="w-5 h-5" />
                    Start Tracking
                  </a>
                  <a
                    href="#features"
                    data-testid="button-learn-more"
                    className="inline-flex items-center px-7 py-3.5 rounded-full font-bold text-base transition-all"
                    style={{ background: "rgba(255,255,255,0.3)", border: "2px solid rgba(255,255,255,0.7)", color: "#fff", textDecoration: "none", backdropFilter: "blur(8px)" }}
                  >
                    Learn More
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-6 text-sm font-semibold" style={{ color: "#fff", textShadow: "0 1px 4px rgba(0,60,120,0.4)" }}>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" style={{ color: "#1a3a7a" }} />
                    <span>Real-time tracking</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BadgeCheck className="w-4 h-4" style={{ color: "#1a3a7a" }} />
                    <span>Irish Owned</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4" style={{ color: "#1a3a7a" }} />
                    <span>Fully Insured</span>
                  </div>
                </div>
              </div>

              <div className="relative" id="login">
                <Card className="border-0" style={{ background: "rgba(255,255,255,0.88)", backdropFilter: "blur(24px)", border: "2px solid rgba(255,255,255,0.9)", boxShadow: "0 12px 56px rgba(0,80,160,0.3), 0 2px 12px rgba(0,0,0,0.15)" }}>
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl" style={{ color: "#0a2a4a" }}>Sign In to LaundryTrack</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="admin" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="factory" data-testid="tab-factory-login">
                          <Building2 className="w-4 h-4 mr-2" />
                          Factory
                        </TabsTrigger>
                        <TabsTrigger value="admin" data-testid="tab-admin-login">
                          <Lock className="w-4 h-4 mr-2" />
                          Admin
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

        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(180deg, #051620 0%, #072535 100%)" }}>
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

        <section className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: "linear-gradient(135deg, #00c8d4 0%, #0078a8 50%, #004a78 100%)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 30% 50%, rgba(255,255,255,0.08) 0%, transparent 60%)" }} />
          <div className="max-w-4xl mx-auto text-center" style={{ position: "relative" }}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: "#fff" }}>
              Ready to Experience Premium Laundry Services?
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto" style={{ color: "rgba(220,250,255,0.85)" }}>
              Join Ireland's most trusted businesses with fresh, hygienic, and on-time 
              laundry solutions from Mr Bubbles Express.
            </p>
            <a
              href="#login"
              data-testid="button-get-started-cta"
              className="inline-flex items-center px-8 py-4 rounded-full font-bold text-base transition-all"
              style={{ background: "#fff", color: "#0078a8", boxShadow: "0 4px 24px rgba(0,0,0,0.25)", textDecoration: "none" }}
            >
              Get Started Now
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8" style={{ background: "#030e16", borderTop: "1px solid rgba(0,200,220,0.15)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <img
                src="/mr-bubbles-logo.png"
                alt="Mr Bubbles Express"
                style={{ height: "44px", width: "auto", objectFit: "contain", mixBlendMode: "screen", opacity: 0.9 }}
              />
            </div>
            <div className="text-sm text-center sm:text-right" style={{ color: "rgba(180,230,240,0.6)" }}>
              <p>Laundry &amp; Linen Specialist | Drogheda, Co. Louth</p>
              <p>086 270 9299 | info@mrbubblesexpress.com</p>
            </div>
          </div>
          <div className="mt-4 pt-4 text-center text-xs" style={{ borderTop: "1px solid rgba(0,200,220,0.1)", color: "rgba(180,230,240,0.4)" }}>
            <p>Certified to ISO 9001 &amp; ISO 45001 | Fully Insured | Irish Owned | Reliable | Innovative</p>
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
    <div className="feature-card-hover rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(0,200,220,0.18)", backdropFilter: "blur(10px)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, rgba(0,200,220,0.25) 0%, rgba(0,120,168,0.25) 100%)", border: "1px solid rgba(0,200,220,0.3)" }}>
        <Icon className="w-6 h-6" style={{ color: "#00d4e0" }} />
      </div>
      <h3 className="font-semibold text-lg mb-2" style={{ color: "#fff" }}>{title}</h3>
      <p style={{ color: "rgba(180,230,240,0.7)" }}>{description}</p>
    </div>
  );
}
