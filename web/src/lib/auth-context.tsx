import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  money: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, adminCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  promote: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const me = await api.get<AuthUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const me = await api.post<AuthUser>("/auth/login", { email, password });
    setUser(me);
  }

  async function register(email: string, password: string, displayName: string, adminCode?: string) {
    const me = await api.post<AuthUser>("/auth/register", { email, password, displayName, adminCode });
    setUser(me);
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  async function promote(code: string) {
    const me = await api.post<AuthUser>("/auth/promote", { code });
    setUser(me);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh, promote }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
