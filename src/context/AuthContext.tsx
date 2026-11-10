import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AUTH_LOGOUT_EVENT, AuthTokens, fetchApi, tokenStore } from '../api/client';

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isVerified: boolean;
  isStaff: boolean;
  /** Store a new session (login, register, or after OTP verification). */
  login: (tokens: AuthTokens, user: UserProfile) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isVerified: false,
  isStaff: false,
  login: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.access && !tokenStore.refresh) {
      setIsLoading(false);
      return;
    }
    // fetchApi refreshes an expired access token automatically.
    fetchApi<UserProfile>('/users/me')
      .then((res) => {
        if (res.success && res.data) setUser(res.data);
        else if (res.error?.code !== 'NETWORK_ERROR') tokenStore.clear();
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    const onForcedLogout = () => setUser(null);
    window.addEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onForcedLogout);
  }, []);

  const login = useCallback((tokens: AuthTokens, userProfile: UserProfile) => {
    tokenStore.set(tokens);
    setUser(userProfile);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = tokenStore.refresh;
    if (refreshToken) {
      fetchApi('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }).catch(() => {});
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  const isVerified = user?.status === 'ACTIVE';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  return (
    <AuthContext.Provider value={{ user, isLoading, isVerified, isStaff, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
