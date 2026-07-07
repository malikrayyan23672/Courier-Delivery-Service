'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { storeTokens, clearStoredTokens } from '@/lib/api';

interface AuthContextValue {
  token: string | null;
  role: string | null;
  /** Log in: persists both tokens and updates state. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Legacy setter: pass null to log out, or a raw access token to set it directly. */
  setToken: (token: string | null) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  role: null,
  setTokens: () => {},
  setToken: () => {},
  isLoading: true,
});

const ACCESS_STORAGE_KEY = 'fastex_access_token';

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
    const stored = localStorage.getItem(ACCESS_STORAGE_KEY);
    setTokenState(stored);
    setIsLoading(false);

    // Keep state in sync when lib/api.ts silently refreshes or force-logs-out
    // after a failed refresh (e.g. the refresh token itself expired).
    function onTokensUpdated(e: Event) {
      const detail = (e as CustomEvent<{ accessToken: string }>).detail;
      if (detail?.accessToken) setTokenState(detail.accessToken);
    }
    function onLogout() {
      setTokenState(null);
    }

    window.addEventListener('auth:tokens-updated', onTokensUpdated);
    window.addEventListener('auth:logout', onLogout);
    return () => {
      window.removeEventListener('auth:tokens-updated', onTokensUpdated);
      window.removeEventListener('auth:logout', onLogout);
    };
  }, []);

  function setTokens(accessToken: string, refreshToken: string) {
    storeTokens(accessToken, refreshToken);
    setTokenState(accessToken);
  }

  function setToken(next: string | null) {
    if (next) {
      setTokenState(next);
      localStorage.setItem(ACCESS_STORAGE_KEY, next);
    } else {
      clearStoredTokens();
      setTokenState(null);
    }
  }

  return (
    <AuthContext.Provider value={{ token, role: decodeRole(token), setTokens, setToken, isLoading }}>
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