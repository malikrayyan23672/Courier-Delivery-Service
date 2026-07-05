'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface AuthContextValue {
  token: string | null;
  role: string | null;
  setToken: (token: string | null) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  role: null,
  setToken: () => {},
  isLoading: true,
});

const STORAGE_KEY = 'fastex_access_token';

function decodeRole(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setTokenState(stored);
    setIsLoading(false);
  }, []);

  function setToken(next: string | null) {
    setTokenState(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <AuthContext.Provider value={{ token, role: decodeRole(token), setToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Maps a backend role name to its panel route. */
export function panelPathForRole(role: string | null): string {
  switch (role) {
    case 'staff':
      return '/staff';
    case 'rider':
      return '/rider';
    case 'admin':
    case 'super_admin':
      return '/admin';
    case 'customer':
    default:
      return '/dashboard';
  }
}
