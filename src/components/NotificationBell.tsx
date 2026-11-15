import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, Tag, CheckCircle, XCircle, RotateCcw, ShieldAlert, ShieldCheck, Clock, PencilLine, MessageSquareText } from 'lucide-react';
import { fetchApi } from '../api/client';
import { AppNotification, notificationLink, useNotifications } from '../context/NotificationsContext';
import { timeAgo } from '../utils/format';

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
  LISTING_CHANGES_REQUESTED: { Icon: PencilLine, color: 'var(--warning)' },
  LISTING_VERIFIED: { Icon: ShieldCheck, color: 'var(--success)' },
  LISTING_REMARK: { Icon: MessageSquareText, color: 'var(--accent-primary)' },
};


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
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell size={21} />
        {unreadCount > 0 && <span className="badge-dot" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="menu"
          style={{ right: '-48px', width: 'min(380px, calc(100vw - 24px))', maxHeight: '480px', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)' }}>Notifications</strong>
            {items.some((n) => !n.isRead) && (
              <button onClick={markAll} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--primary-text)', fontWeight: 600 }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {desktopAlerts === 'default' && (
            <button
              onClick={enableDesktopAlerts}
              className="tip-box"
              style={{ margin: '0.6rem 0.75rem 0', textAlign: 'left', fontSize: '0.8rem' }}
            >
              <Bell size={15} style={{ flexShrink: 0, marginTop: 2 }} /> Get desktop alerts for messages and offers, even when this tab is in the background
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
                    style={{ width: '100%', display: 'flex', gap: '0.7rem', alignItems: 'flex-start', textAlign: 'left', padding: '0.7rem 0.75rem', borderRadius: '10px', background: n.isRead ? 'transparent' : 'var(--primary-soft)', color: 'var(--text-primary)', marginBottom: '2px' }}
                  >
                    <span style={{ width: 34, height: 34, borderRadius: 999, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 13%, transparent)` }}>
                      <Icon size={17} color={color} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.86rem', fontWeight: n.isRead ? 500 : 700 }}>{n.title}</span>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</span>
                      <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{timeAgo(n.createdAt)}</span>
                    </span>
                    {!n.isRead && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '6px', flexShrink: 0 }} />}
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
