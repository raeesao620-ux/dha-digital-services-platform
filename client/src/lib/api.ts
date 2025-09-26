import { queryClient } from "@/lib/queryClient";

const API_BASE = "/api";

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Get authentication token
    const token = localStorage.getItem("authToken");

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If parsing JSON fails, use the default error message
        }

        if (response.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem("authToken");
          window.location.href = "/login";
          throw new Error("Authentication required");
        }

        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return {} as T;
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "GET",
    });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }

  async postFormData<T = any>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const token = localStorage.getItem("authToken");

    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          // If parsing JSON fails, use the default error message
        }

        if (response.status === 401) {
          localStorage.removeItem("authToken");
          window.location.href = "/login";
          throw new Error("Authentication required");
        }

        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error(`Form data request failed: ${url}`, error);
      throw error;
    }
  }
}

// Authentication helpers
export const auth = {
  async login(email: string, password: string) {
    const response = await api.post<{
      token: string;
      user: {
        id: string;
        username: string;
        email: string;
        role: string;
      };
      fraudAnalysis: {
        riskScore: number;
        riskLevel: string;
      };
    }>("/auth/login", { email, password });

    // Store token
    localStorage.setItem("authToken", response.token);

    // Store user info
    localStorage.setItem("user", JSON.stringify(response.user));

    return response;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role?: string;
  }) {
    const response = await api.post<{
      token: string;
      user: {
        id: string;
        username: string;
        email: string;
        role: string;
      };
    }>("/auth/register", userData);

    // Store token
    localStorage.setItem("authToken", response.token);

    // Store user info
    localStorage.setItem("user", JSON.stringify(response.user));

    return response;
  },

  logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");

    // Clear query cache
    queryClient.clear();

    // Redirect to login
    window.location.href = "/login";
  },

  getCurrentUser() {
    const userStr = localStorage.getItem("user");
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem("authToken");
  }
};

// Create API client instance
export const api = new ApiClient();

// Export default
export default api;