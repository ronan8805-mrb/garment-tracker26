import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import AdminDashboard from "@/pages/admin-dashboard";
import FactoryDashboard from "@/pages/factory-dashboard";
import FactoriesPage from "@/pages/factories";
import GarmentsPage from "@/pages/garments";
import ScanPage from "@/pages/scan";
import ReportsPage from "@/pages/reports";
import InvoicesPage from "@/pages/invoices";
import { initWebSocket, closeWebSocket } from "@/lib/websocket";

function AuthenticatedLayout({ children, isFactorySession, isAdminSession }: { children: React.ReactNode; isFactorySession?: boolean; isAdminSession?: boolean }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const userProfile = isAdminSession 
    ? { role: "admin" as const, factoryId: null, id: "", userId: "", createdAt: new Date() }
    : { role: "factory" as const, factoryId: null, id: "", userId: "", createdAt: new Date() };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar userProfile={userProfile} isFactorySession={isFactorySession} isAdminSession={isAdminSession} />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRouter({ isFactorySession, isAdminSession }: { isFactorySession?: boolean; isAdminSession?: boolean }) {
  const isAdmin = isAdminSession ?? false;
  const { factorySession } = useAuth();

  const effectiveProfile = isAdmin 
    ? { role: "admin" as const, factoryId: null, id: "", userId: "", createdAt: new Date() }
    : { role: "factory" as const, factoryId: factorySession?.factoryId || null, id: "", userId: "", createdAt: new Date() };

  return (
    <AuthenticatedLayout isFactorySession={isFactorySession} isAdminSession={isAdminSession}>
      <Switch>
        <Route path="/">
          {isAdmin ? <AdminDashboard /> : <FactoryDashboard />}
        </Route>
        {isAdmin && (
          <Route path="/factories" component={FactoriesPage} />
        )}
        <Route path="/garments" component={GarmentsPage} />
        <Route path="/scan">
          <ScanPage userProfile={effectiveProfile} />
        </Route>
        <Route path="/reports" component={ReportsPage} />
        {isAdmin && (
          <Route path="/invoices" component={InvoicesPage} />
        )}
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function Router() {
  const { isLoading, isAuthenticated, isFactorySession, isAdminSession } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      initWebSocket();
      return () => closeWebSocket();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return <AuthenticatedRouter isFactorySession={isFactorySession} isAdminSession={isAdminSession} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="laundry-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
