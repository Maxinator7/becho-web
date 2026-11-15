import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import {
  ArrowLeft, Compass, Heart, Home as HomeIcon, List, LogOut, MessageCircle, Plus, Search, ShoppingBag, User,
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { LocationSelector } from './LocationSelector';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar } from './ui';

interface ConversationSummary {
  id: string;
  messages?: { senderId: string; isRead: boolean }[];
}

/**
 * Conversations whose latest message is from the other person and still unread.
 * Re-checked whenever the notification count changes (that context already polls).
 */
function useUnreadChats() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user) { setCount(0); return; }
    let cancelled = false;
    fetchApi<ConversationSummary[]>('/conversations').then((res) => {
      if (cancelled || !res.success || !res.data) return;
      setCount(res.data.filter((c) => { const m = c.messages?.[0]; return m && m.senderId !== user.id && !m.isRead; }).length);
    });
    return () => { cancelled = true; };
  }, [user, unreadCount]);
  return count;
}

const AccountMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!user) return null;
  const go = (to: string) => { setOpen(false); navigate(to); };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" title={user.displayName} style={{ display: 'flex', padding: 2, borderRadius: 999 }}>
        <Avatar name={user.displayName} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 4 }}>
            <Avatar name={user.displayName} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.displayName}</div>
              {user.userCode && <div className="muted" style={{ fontSize: '0.75rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{user.userCode}</div>}
            </div>
          </div>
          <button role="menuitem" className="menu-item" onClick={() => go('/account')}><User size={16} /> My account</button>
          <button role="menuitem" className="menu-item" onClick={() => go('/my-listings')}><List size={16} /> My listings</button>
          <button role="menuitem" className="menu-item" onClick={() => go('/favorites')}><Heart size={16} /> Saved ads</button>
          <div className="menu-item" style={{ justifyContent: 'space-between', cursor: 'default' }}>
            <span>Theme</span>
            <ThemeToggle />
          </div>
          <button role="menuitem" className="menu-item danger" onClick={() => { setOpen(false); logout(); navigate('/'); }}><LogOut size={16} /> Sign out</button>
        </div>
      )}
    </div>
  );
};

const TopSearch: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  return (
    <form
      className="topbar-search"
      role="search"
      onSubmit={(e) => { e.preventDefault(); navigate(q.trim() ? `/browse?search=${encodeURIComponent(q.trim())}` : '/browse'); }}
    >
      <label className="searchbar">
        <Search size={18} />
        <span className="sr-only">Search listings</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phones, bikes, sofas…" />
      </label>
    </form>
  );
};

/** Bottom tab bar shown at phone widths. */
const BottomTabs: React.FC<{ chatBadge: number }> = ({ chatBadge }) => {
  const { pathname } = useRouterLocation();
  const tab = (to: string, label: string, Icon: typeof HomeIcon, active: boolean, badge = 0) => (
    <Link to={to} className={`tab${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
      <span className="tab-icon">
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        {badge > 0 && <span className="tab-badge" aria-label={`${badge} unread`}>{badge > 9 ? '9+' : badge}</span>}
      </span>
      {label}
    </Link>
  );
  return (
    <nav className="bottom-tabs" aria-label="Main">
      {tab('/', 'Home', HomeIcon, pathname === '/')}
      {tab('/browse', 'Explore', Compass, pathname.startsWith('/browse'))}
      <Link to="/create-listing" className="tab-fab" aria-label="Sell an item">
        <span className="fab"><Plus size={26} strokeWidth={2.4} /></span>
        Sell
      </Link>
      {tab('/chat', 'Chats', MessageCircle, pathname.startsWith('/chat'), chatBadge)}
      {tab('/account', 'Account', User, pathname.startsWith('/account') || pathname.startsWith('/my-listings') || pathname.startsWith('/favorites'))}
    </nav>
  );
};

interface NavbarProps {
  /** Mobile only: replace the logo bar with "← title" (detail screens). */
  title?: string;
  /** Where the mobile back arrow goes; default is the previous page. */
  backTo?: string;
  /** Mobile only: buttons on the right of the sub-header. */
  actions?: React.ReactNode;
  /** Hide the bottom tab bar (screens with their own sticky action bar). */
  hideTabs?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ title, backTo, actions, hideTabs }) => {
  const { user, isVerified } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useRouterLocation();
  const onAccountPage = pathname === '/account';
  const chatBadge = useUnreadChats();

  const back = () => {
    if (backTo) navigate(backTo);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <>
      <header className={`topbar${title ? ' has-sub' : ''}`}>
        <div className="topbar-inner topbar-main">
          <Link to="/" className="brand" aria-label="Becho home">
            <span className="brand-mark" aria-hidden="true"><ShoppingBag size={17} strokeWidth={2.4} /></span>
            Becho
          </Link>
          <LocationSelector />
          <TopSearch />

          <div className="topbar-right">
            <nav className="topbar-links" aria-label="Main">
              <NavLink to="/browse" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`} title="Explore">
                <Compass size={18} /> <span className="label">Explore</span>
              </NavLink>
              {user && (
                <>
                  <NavLink to="/chat" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`} title="Chats">
                    <MessageCircle size={18} /> <span className="label">Chats</span>
                    {chatBadge > 0 && <span className="chip chip-primary" style={{ padding: '0 6px', fontSize: '0.68rem' }}>{chatBadge}</span>}
                  </NavLink>
                  <NavLink to="/favorites" className={({ isActive }) => `topbar-link${isActive ? ' active' : ''}`} title="Saved">
                    <Heart size={18} /> <span className="label">Saved</span>
                  </NavLink>
                </>
              )}
            </nav>

            {user ? (
              <>
                <NotificationBell />
                <Link to="/create-listing" className="btn-primary desktop-only" style={{ minHeight: 40 }}>
                  <Plus size={18} /> Sell
                </Link>
                <AccountMenu />
              </>
            ) : (
              <>
                <span className="desktop-only"><ThemeToggle /></span>
                <Link to="/login" className="btn btn-ghost desktop-only">Sign in</Link>
                <Link to="/register" className="btn-primary desktop-only">Create account</Link>
                <Link to="/login" className="btn-primary btn-sm mobile-only">Sign in</Link>
              </>
            )}
          </div>
        </div>

        {title && (
          <div className="subbar">
            <button type="button" className="icon-btn" onClick={back} aria-label="Back"><ArrowLeft size={22} /></button>
            <div className="subbar-title">{title}</div>
            {actions}
          </div>
        )}
      </header>

      {user && isVerified && !user.phone && !onAccountPage && (
        <div className="notice-strip">
          <div role="status" className="remark-box warn" style={{ color: 'var(--text-primary)' }}>
            Add your mobile number to keep your account secure. <Link to="/account" className="link" style={{ color: 'var(--warning)' }}>Add mobile number</Link>
          </div>
        </div>
      )}
      {user && !isVerified && (
        <div className="notice-strip">
          <div className="remark-box warn" style={{ color: 'var(--text-primary)' }}>
            Verify your account to sell, chat and make offers. <Link to="/verify" className="link" style={{ color: 'var(--warning)' }}>Verify now</Link>
          </div>
        </div>
      )}

      {!hideTabs && <BottomTabs chatBadge={chatBadge} />}
    </>
  );
};
