import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 Unauthorized responses
    if (res.status === 401) {
      // Clear authentication data and redirect to login
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      window.location.href = "/login";
      throw new Error("Authentication required");
    }

    let errorMessage = `${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorData.message || errorMessage;
    } catch {
      // If parsing JSON fails, use the default error message
      const text = await res.text();
      errorMessage = text || errorMessage;
    }
    
    throw new Error(errorMessage);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem("authToken");
  const headers: HeadersInit = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = localStorage.getItem("authToken");
    const headers: HeadersInit = {};
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(queryKey.join("/") as string, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // Still clear tokens even when returning null
      localStorage.removeItem("authToken");
      localStorage.removeItem("user");
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes default stale time for better caching
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection time
      retry: (failureCount, error) => {
        // Only retry on network errors, not client errors
        if (error instanceof Error && error.message.includes('fetch')) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false,
      // Add optimistic updates configuration
      onError: (error: Error, variables: unknown, context: any) => {
        console.error('Mutation error:', error);
        // Rollback optimistic updates if available
        if (context?.rollback) {
          context.rollback();
        }
      },
    },
  },
});
