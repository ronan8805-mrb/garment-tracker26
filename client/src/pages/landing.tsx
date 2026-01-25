import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Factory, ScanLine, FileText, Shield, Zap, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
                <Factory className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">LaundryTrack</span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/api/login"
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-login-nav"
              >
                Sign In
              </a>
              <Button asChild data-testid="button-get-started-nav">
                <a href="/api/login">Get Started</a>
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
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    Industrial Garment
                    <span className="block text-primary">Tracking Made Simple</span>
                  </h1>
                  <p className="text-lg sm:text-xl text-muted-foreground max-w-lg">
                    QR-code driven track-and-trace solution for industrial laundries.
                    Manage garments across multiple factories with real-time visibility.
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button size="lg" asChild data-testid="button-get-started-hero">
                    <a href="/api/login">
                      <ScanLine className="w-5 h-5 mr-2" />
                      Start Tracking
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" asChild data-testid="button-learn-more">
                    <a href="#features">Learn More</a>
                  </Button>
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>Scan-driven accuracy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span>Real-time tracking</span>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-2xl p-8 border">
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard label="Garments Tracked" value="10K+" />
                    <StatCard label="Factories" value="50+" />
                    <StatCard label="Scans/Day" value="5K+" />
                    <StatCard label="Uptime" value="99.9%" />
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Everything You Need for Garment Management
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A complete solution designed for industrial laundries managing garments
                across multiple factory locations.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={ScanLine}
                title="QR Code Scanning"
                description="Fast, accurate scanning with NETUM CS7501 compatible readers. Batch scan hundreds of garments in minutes."
              />
              <FeatureCard
                icon={Factory}
                title="Multi-Factory Support"
                description="Manage garments across unlimited factories. Each factory gets their own secure portal and credentials."
              />
              <FeatureCard
                icon={FileText}
                title="PDF Reports"
                description="Generate professional batch reports and QR code sheets. Print-ready A4 format for label printers."
              />
              <FeatureCard
                icon={Shield}
                title="Immutable Audit Trail"
                description="Every scan is permanently recorded. Complete visibility into garment movement history."
              />
              <FeatureCard
                icon={Globe}
                title="Real-time Status"
                description="Know exactly where every garment is. Simple two-location model: At Factory or At Laundry."
              />
              <FeatureCard
                icon={Zap}
                title="Batch Operations"
                description="Process large volumes efficiently. Live counters, duplicate detection, and instant confirmation."
              />
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to Modernize Your Laundry Operations?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join industrial laundries that trust LaundryTrack for accurate,
              efficient garment management.
            </p>
            <Button size="lg" asChild data-testid="button-get-started-cta">
              <a href="/api/login">
                Get Started Now
              </a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-primary" />
            <span className="font-semibold">LaundryTrack</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Industrial Garment Tracking System
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-0 bg-background/60 backdrop-blur-sm">
      <CardContent className="p-4 text-center">
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
