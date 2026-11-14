import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchApi } from '../api/client';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: { conversationId?: string | null; listingId?: string; offerId?: string; count?: number } | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsContextValue {
  unreadCount: number;
  /** Re-check now (e.g. after opening a chat that marked things read). */
  refresh: () => void;
  desktopAlerts: NotificationPermission | 'unsupported';
  enableDesktopAlerts: () => Promise<void>;
}

const POLL_MS = 20_000;
const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

/** Where clicking a notification should take the user. */
export function notificationLink(n: AppNotification): string {
  if (n.data?.conversationId) return `/chat?conversationId=${n.data.conversationId}`;
  if (n.type.startsWith('LISTING_') && n.type !== 'LISTING_SOLD') return '/my-listings';
  if (n.data?.listingId) return `/listings/${n.data.listingId}`;
  return '/';
}

const desktopSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [desktopAlerts, setDesktopAlerts] = useState<NotificationPermission | 'unsupported'>(
    desktopSupported() ? Notification.permission : 'unsupported'
  );
  const lastCount = useRef(0);
  const shownIds = useRef(new Set<string>());

  /** While the tab is in the background, surface new notifications as OS notifications. */
  const showDesktop = useCallback(async () => {
    if (!desktopSupported() || Notification.permission !== 'granted' || !document.hidden) return;
    const res = await fetchApi<{ notifications: AppNotification[] }>('/notifications?limit=5');
    for (const n of res.data?.notifications ?? []) {
      if (n.isRead || shownIds.current.has(n.id + n.createdAt)) continue;
      shownIds.current.add(n.id + n.createdAt);
      const alert = new Notification(n.title, { body: n.body, tag: n.id, icon: '/favicon.svg' });
      alert.onclick = () => {
        window.focus();
        window.location.assign(notificationLink(n));
      };
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    const res = await fetchApi<{ unreadCount: number }>('/notifications/unread-count');
    if (!res.success || !res.data) return;
    const count = res.data.unreadCount;
    if (count > lastCount.current) void showDesktop();
    lastCount.current = count;
    setUnreadCount(count);
  }, [user, showDesktop]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      lastCount.current = 0;
      return;
    }
    void refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, refresh]);

  // "(3) Becho" in the browser tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
    document.title = unreadCount > 0 ? `(${unreadCount > 99 ? '99+' : unreadCount}) ${base}` : base;
  }, [unreadCount]);

  const enableDesktopAlerts = async () => {
    if (!desktopSupported()) return;
    setDesktopAlerts(await Notification.requestPermission());
  };

  return (
    <NotificationsContext.Provider value={{ unreadCount, refresh: () => void refresh(), desktopAlerts, enableDesktopAlerts }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
