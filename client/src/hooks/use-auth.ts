import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SessionInfo {
  isLoggedIn: boolean;
  isAdmin?: boolean;
  factoryId?: string;
  factoryName?: string;
}

async function fetchSession(): Promise<SessionInfo> {
  const response = await fetch("/api/factory/session", {
    credentials: "include",
  });

  if (!response.ok) {
    return { isLoggedIn: false };
  }

  return response.json();
}

async function sessionLogout(): Promise<void> {
  await fetch("/api/factory/logout", {
    method: "POST",
    credentials: "include",
  });
  window.location.href = "/";
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery<SessionInfo>({
    queryKey: ["/api/factory/session"],
    queryFn: fetchSession,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const logoutMutation = useMutation({
    mutationFn: sessionLogout,
    onSuccess: () => {
      queryClient.setQueryData(["/api/factory/session"], { isLoggedIn: false });
    },
  });

  const isAuthenticated = session?.isLoggedIn ?? false;
  const isFactorySession = !!(session?.isLoggedIn && !session?.isAdmin);
  const isAdminSession = !!(session?.isLoggedIn && session?.isAdmin);

  return {
    user: null,
    isLoading,
    isAuthenticated,
    isFactorySession,
    isAdminSession,
    factorySession: session,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
