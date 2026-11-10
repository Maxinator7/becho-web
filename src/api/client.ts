const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Fired when the session can no longer be refreshed; AuthContext listens and logs out. */
export const AUTH_LOGOUT_EVENT = 'becho:auth-logout';

function storageGet(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export const tokenStore = {
  get access() { return storageGet('accessToken'); },
  get refresh() { return storageGet('refreshToken'); },
  set(tokens: AuthTokens) {
    try {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    } catch { /* storage unavailable: session lasts for this tab only */ }
  },
  clear() {
    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } catch { /* ignore */ }
  },
};

// Single in-flight refresh shared by all concurrent requests that hit a 401.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      tokenStore.set(json.data);
      return true;
    }
  } catch {
    // Network error: keep tokens, the next request can retry.
    return false;
  }
  tokenStore.clear();
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
  return false;
}

async function rawRequest(endpoint: string, options: RequestInit) {
  const token = tokenStore.access;
  return fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    let response = await rawRequest(endpoint, options);

    // Access tokens live 15 minutes; transparently refresh once and retry.
    if (response.status === 401 && tokenStore.refresh && !endpoint.startsWith('/auth/')) {
      refreshInFlight ??= refreshSession().finally(() => { refreshInFlight = null; });
      if (await refreshInFlight) response = await rawRequest(endpoint, options);
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    return { success: false, error: { code: 'NETWORK_ERROR', message: 'Could not reach Becho. Check your connection.' } };
  }
}
