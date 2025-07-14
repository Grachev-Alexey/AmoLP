import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function useAuthRedirect() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Необходима авторизация",
        description: "Выполняется перенаправление на страницу входа...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  return { isAuthenticated, isLoading };
}

export function isUnauthorizedError(error: any): boolean {
  return error?.status === 401 || error?.response?.status === 401;
}

export function handleUnauthorizedError(error: any, toast: any) {
  toast({
    title: "Сессия истекла",
    description: "Выполняется перенаправление на страницу входа...",
    variant: "destructive",
  });
  setTimeout(() => {
    window.location.href = "/auth";
  }, 500);
}

// Общая функция для logout с очисткой кеша
export function createLogoutMutation(queryClient: any) {
  return {
    mutationFn: async () => {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.clear();
      window.location.replace("/auth");
    },
    onError: () => {
      queryClient.clear();
      window.location.replace("/auth");
    },
  };
}