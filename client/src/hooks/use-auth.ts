import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/models/auth";

interface FactorySession {
  isLoggedIn: boolean;
  factoryId?: string;
  factoryName?: string;
}

async function fetchUser(): Promise<User | null> {
  const response = await fetch("/api/auth/user", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function fetchFactorySession(): Promise<FactorySession> {
  const response = await fetch("/api/factory/session", {
    credentials: "include",
  });

  if (!response.ok) {
    return { isLoggedIn: false };
  }

  return response.json();
}

async function logout(): Promise<void> {
  window.location.href = "/api/logout";
}

async function factoryLogout(): Promise<void> {
  await fetch("/api/factory/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading: isUserLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { data: factorySession, isLoading: isFactoryLoading } = useQuery<FactorySession>({
    queryKey: ["/api/factory/session"],
    queryFn: fetchFactorySession,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  const factoryLogoutMutation = useMutation({
    mutationFn: factoryLogout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/factory/session"], { isLoggedIn: false });
    },
  });

  const isLoading = isUserLoading || isFactoryLoading;
  const isAuthenticated = !!user || (factorySession?.isLoggedIn ?? false);
  const isFactorySession = factorySession?.isLoggedIn ?? false;

  return {
    user,
    isLoading,
    isAuthenticated,
    isFactorySession,
    factorySession,
    logout: isFactorySession ? factoryLogoutMutation.mutate : logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending || factoryLogoutMutation.isPending,
  };
}
