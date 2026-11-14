import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, Tag, CheckCircle, XCircle, RotateCcw, ShieldAlert, Clock } from 'lucide-react';
import { fetchApi } from '../api/client';
import { AppNotification, notificationLink, useNotifications } from '../context/NotificationsContext';

const ICONS: Record<string, { Icon: typeof Bell; color: string }> = {
  MESSAGE_RECEIVED: { Icon: MessageSquare, color: 'var(--accent-primary)' },
  OFFER_CREATED: { Icon: Tag, color: 'var(--warning)' },
  OFFER_COUNTERED: { Icon: RotateCcw, color: 'var(--accent-primary)' },
  OFFER_ACCEPTED: { Icon: CheckCircle, color: 'var(--success)' },
  OFFER_REJECTED: { Icon: XCircle, color: 'var(--danger)' },
  LISTING_APPROVED: { Icon: CheckCircle, color: 'var(--success)' },
  LISTING_REJECTED: { Icon: ShieldAlert, color: 'var(--danger)' },
  LISTING_SUSPENDED: { Icon: ShieldAlert, color: 'var(--danger)' },
  LISTING_EXPIRED: { Icon: Clock, color: 'var(--text-secondary)' },
  LISTING_SOLD: { Icon: CheckCircle, color: 'var(--text-secondary)' },
  RESERVATION_RELEASED: { Icon: RotateCcw, color: 'var(--warning)' },
};

function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const NotificationBell: React.FC = () => {
  const { unreadCount, refresh, desktopAlerts, enableDesktopAlerts } = useNotifications();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetchApi<{ notifications: AppNotification[] }>('/notifications?limit=15');
    if (res.success && res.data) setItems(res.data.notifications);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void load();
    // Reload the open list when new notifications arrive.
  }, [open, unreadCount]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.isRead) {
      await fetchApi(`/notifications/${n.id}/read`, { method: 'POST' });
      refresh();
    }
    navigate(notificationLink(n));
  };

  const markAll = async () => {
    await fetchApi('/notifications/read-all', { method: 'POST' });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    refresh();
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
        style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', padding: '0 5px', borderRadius: '9px', background: 'var(--danger)', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 10px)', width: 'min(380px, calc(100vw - 32px))', maxHeight: '480px', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '14px', boxShadow: 'var(--shadow)', overflow: 'hidden' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '0.95rem' }}>Notifications</strong>
            {items.some((n) => !n.isRead) && (
              <button onClick={markAll} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {desktopAlerts === 'default' && (
            <button
              onClick={enableDesktopAlerts}
              style={{ margin: '0.6rem 0.75rem 0', padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'left' }}
            >
              🔔 Get desktop alerts for messages and offers, even when this tab is in the background
            </button>
          )}

          <div style={{ overflowY: 'auto', padding: '0.4rem' }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                No notifications yet. You’ll see new messages and offers here.
              </div>
            ) : (
              items.map((n) => {
                const { Icon, color } = ICONS[n.type] ?? { Icon: Bell, color: 'var(--text-secondary)' };
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    style={{ width: '100%', display: 'flex', gap: '0.7rem', alignItems: 'flex-start', textAlign: 'left', padding: '0.7rem 0.75rem', borderRadius: '10px', background: n.isRead ? 'transparent' : 'var(--surface-2)', color: 'var(--text-primary)' }}
                  >
                    <Icon size={18} color={color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: n.isRead ? 500 : 700 }}>{n.title}</span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-primary)', marginTop: '6px', flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
