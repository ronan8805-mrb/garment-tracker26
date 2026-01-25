import { Link, useLocation } from "wouter";
import {
  Sparkles,
  LayoutDashboard,
  Shirt,
  ScanLine,
  FileText,
  Settings,
  LogOut,
  Building2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import type { UserProfile } from "@shared/schema";

interface AppSidebarProps {
  userProfile: UserProfile | null;
}

export function AppSidebar({ userProfile }: AppSidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const isAdmin = userProfile?.role === "admin";

  const adminItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Factories", url: "/factories", icon: Building2 },
    { title: "Garments", url: "/garments", icon: Shirt },
    { title: "Scanning", url: "/scan", icon: ScanLine },
    { title: "Reports", url: "/reports", icon: FileText },
  ];

  const factoryItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Scanning", url: "/scan", icon: ScanLine },
    { title: "My Garments", url: "/garments", icon: Shirt },
  ];

  const items = isAdmin ? adminItems : factoryItems;

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sidebar-primary">
            <Sparkles className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sidebar-foreground">Mr Bubbles</span>
            <span className="text-xs text-sidebar-foreground/70">
              {isAdmin ? "Admin Portal" : "Client Portal"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : user?.email}
            </p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {isAdmin ? "Administrator" : "Factory User"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
