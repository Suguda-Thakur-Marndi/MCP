"use client";

import { useCallback, useEffect, useState } from "react";
import { api, CurrentUser } from "@/lib/api";

export interface UseAuthResult {
  user: CurrentUser | null;
  role: string;
  email: string;
  token: string | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSecurityLead: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: string[]) => boolean;
  login: (token: string, user?: CurrentUser) => void;
  logout: () => void;
  refresh: () => Promise<CurrentUser | null>;
}

/**
 * useAuth
 * Centralized authentication and RBAC authorization hook for SentinelCore console.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const [role, setRole] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);

  const syncLocalCredentials = useCallback(() => {
    if (typeof window === "undefined") return;
    const t = localStorage.getItem("sentinel_token");
    const r = localStorage.getItem("sentinel_role") || "";
    const e = localStorage.getItem("sentinel_email") || "";
    setToken(t);
    setRole(r);
    setEmail(e);
  }, []);

  const refresh = useCallback(async (): Promise<CurrentUser | null> => {
    setLoading(true);
    setError(null);
    try {
      syncLocalCredentials();
      const me = await api.auth.me();
      setUser(me);
      if (me.role) setRole(me.role);
      if (me.email) setEmail(me.email);
      setLoading(false);
      return me;
    } catch (err: unknown) {
      const parsedErr = err instanceof Error ? err : new Error("Failed to verify user credentials");
      setError(parsedErr);
      setUser(null);
      setRole("");
      setEmail("");
      setLoading(false);
      return null;
    }
  }, [syncLocalCredentials]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    (newToken: string, newUser?: CurrentUser) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("sentinel_token", newToken);
        if (newUser) {
          localStorage.setItem("sentinel_role", newUser.role);
          localStorage.setItem("sentinel_email", newUser.email);
          setUser(newUser);
          setRole(newUser.role);
          setEmail(newUser.email);
        }
        setToken(newToken);
      }
      void refresh();
    },
    [refresh]
  );

  const logout = useCallback(() => {
    // Notify server to invalidate DB session and revoke HttpOnly cookie
    api.auth.logout().catch(() => {
      // Ignore network errors on logout
    });
    if (typeof window !== "undefined") {
      localStorage.removeItem("sentinel_token");
      localStorage.removeItem("sentinel_role");
      localStorage.removeItem("sentinel_email");
    }
    setToken(null);
    setUser(null);
    setRole("");
    setEmail("");
  }, []);

  const currentRole = (user?.role || role || "").toUpperCase();
  const isAdmin = currentRole === "ADMIN";
  const isSecurityLead = currentRole === "SECURITY_LEAD" || isAdmin;
  const isAuthenticated = Boolean(user && user.is_active);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      if (isAdmin) return true;
      if (user.permissions && Array.isArray(user.permissions)) {
        return user.permissions.includes(permission) || user.permissions.includes("*");
      }
      return false;
    },
    [user, isAdmin]
  );

  const hasRole = useCallback(
    (roles: string[]): boolean => {
      const normalized = roles.map((r) => r.toUpperCase());
      return normalized.includes(currentRole);
    },
    [currentRole]
  );

  return {
    user,
    role: currentRole,
    email: user?.email || email,
    token,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    isSecurityLead,
    hasPermission,
    hasRole,
    login,
    logout,
    refresh,
  };
}
