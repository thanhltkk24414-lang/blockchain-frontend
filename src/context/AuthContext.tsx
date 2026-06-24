import { createContext, useContext, type ReactNode } from 'react';
import { useAuth as useAuthState } from '../hooks/useAuth';

type AuthContextValue = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
