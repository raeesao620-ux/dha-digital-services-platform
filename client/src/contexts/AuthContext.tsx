import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// SECURITY: All mock authentication and development bypasses have been REMOVED
// Production-ready authentication required for all environments

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (error) {
        console.error("Failed to parse stored user:", error);
        localStorage.removeItem("user");
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      return storedToken;
    }
    // Clean up invalid token if user doesn't exist but token does
    if (!localStorage.getItem("user") && storedToken) {
      localStorage.removeItem("authToken");
    }
    return null;
  });

  const [, setLocation] = useLocation();

  // SECURITY: All development bypasses and auto-authentication removed
  // Users must authenticate through proper login flow in ALL environments

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("authToken", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setLocation("/login");
  };

  const checkAuth = () => {
    return !!token && !!user;
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        login,
        logout,
        checkAuth
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}