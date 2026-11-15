import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { identifyUser } from '../analytics';
import { AUTH_LOGOUT_EVENT, AuthTokens, fetchApi, tokenStore } from '../api/client';

export interface UserProfile {
  id: string;
  /** Public account code, e.g. BCH-7K2M9Q — can be used to sign in. */
  userCode?: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  role: string;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isVerified: boolean;
  isStaff: boolean;
  /** Store a new session (login, register, or after OTP verification). */
  login: (tokens: AuthTokens, user: UserProfile) => void;
  logout: () => void;
  /** Re-read the profile from GET /users/me (after edits). */
  refreshUser: () => Promise<void>;
  /** Replace the cached profile with one returned by the API. */
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isVerified: false,
  isStaff: false,
  login: () => {},
  logout: () => {},
  refreshUser: async () => {},
  updateUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Link analytics events to the signed-in user (internal id + user code only; no email/phone).
  useEffect(() => {
    identifyUser(user ? { id: user.id, userCode: user.userCode, role: user.role, status: user.status } : null);
  }, [user?.id, user?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const refreshUser = useCallback(async () => {
    const res = await fetchApi<UserProfile>('/users/me');
    if (res.success && res.data) setUser(res.data);
  }, []);

  const updateUser = useCallback((profile: UserProfile) => setUser((prev) => (prev ? { ...prev, ...profile } : profile)), []);

  const isVerified = user?.status === 'ACTIVE';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR';

  return (
    <AuthContext.Provider value={{ user, isLoading, isVerified, isStaff, login, logout, refreshUser, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
