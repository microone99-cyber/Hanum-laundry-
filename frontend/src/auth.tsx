import React, { createContext, useContext, useEffect, useState } from "react";
import { api, setToken, loadToken } from "@/src/api";

export type User = {
  id: string;
  email: string;
  nama: string;
  role: string;
  telepon?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nama: string, telepon: string) => Promise<void>;
  logout: () => Promise<void>;
  isStaff: boolean;
};

const Ctx = createContext<AuthCtx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) {
        try {
          const me = await api.get("/auth/me");
          setUser(me);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await setToken(res.token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, nama: string, telepon: string) => {
    const res = await api.post("/auth/register", { email, password, nama, telepon });
    await setToken(res.token);
    setUser(res.user);
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  const isStaff = !!user && ["owner", "admin", "kasir"].includes(user.role);

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, isStaff }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
