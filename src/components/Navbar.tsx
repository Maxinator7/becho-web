import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams, useLocation as useRouterLocation } from 'react-router-dom';
import {
  ArrowLeft, BadgeCheck, Compass, Heart, Home as HomeIcon, List, LogOut, MessageCircle, MessageSquare, Plus, Search, User,
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { LocationSelector } from './LocationSelector';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Avatar, useCategories } from './ui';
import { useLocation } from '../context/LocationContext';

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
  const both = !!user.emailVerifiedAt && !!user.phoneVerifiedAt;
  const trust = both ? 'Email & Mobile verified' : user.emailVerifiedAt ? 'Email verified' : user.phoneVerifiedAt ? 'Mobile verified' : null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="user-chip" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" title={user.displayName}>
        <Avatar name={user.displayName} />
        <span className="user-chip-text desktop-only">
          <span className="user-chip-name">
            <span className="nm">{user.displayName}</span>
            {user.userCode && <span className="code-tag">{user.userCode}</span>}
          </span>
          {trust && <span className="user-chip-trust">{trust}</span>}
        </span>
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

/** Desktop search: category + text, opens Browse. */
const TopSearch: React.FC = () => {
  const navigate = useNavigate();
  const categories = useCategories();
  const [params] = useSearchParams();
  const { pathname } = useRouterLocation();
  const onBrowse = pathname.startsWith('/browse');
  const [q, setQ] = useState(onBrowse ? params.get('search') ?? '' : '');
  const [cat, setCat] = useState(onBrowse ? params.get('categoryId') ?? '' : '');
  useEffect(() => {
    if (!onBrowse) return;
    setQ(params.get('search') ?? '');
    setCat(params.get('categoryId') ?? '');
  }, [onBrowse, params]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (cat) next.set('categoryId', cat);
    if (q.trim()) next.set('search', q.trim());
    const qs = next.toString();
    navigate(qs ? `/browse?${qs}` : '/browse');
  };

  return (
    <form className="topbar-search" role="search" onSubmit={submit}>
      <label className="sr-only" htmlFor="top-cat">Category</label>
      <select id="top-cat" className="ts-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <label className="sr-only" htmlFor="top-q">Search listings</label>
      <input id="top-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search phones, bikes, sofas…" />
      <button type="submit" className="ts-go" aria-label="Search"><Search size={18} /></button>
    </form>
  );
};

/** Desktop row of top-level categories under the header. */
const CategoryNav: React.FC = () => {
  const categories = useCategories();
  const [params] = useSearchParams();
  const { pathname } = useRouterLocation();
  const current = pathname.startsWith('/browse') ? params.get('categoryId') ?? '' : null;
  if (categories.length === 0) return null;
  return (
    <nav className="catnav" aria-label="Categories">
      <div className="catnav-inner">
        <Link to="/browse" className={`catnav-link${current === '' ? ' active' : ''}`}>All categories</Link>
        {categories.map((c) => (
          <Link key={c.id} to={`/browse?categoryId=${c.id}`} className={`catnav-link${current === c.id ? ' active' : ''}`}>{c.name}</Link>
        ))}
      </div>
    </nav>
  );
};

/** Site footer (desktop). Only links to pages that exist. */
const NO_FOOTER = ['/login', '/register', '/forgot-password', '/verify'];

export const Footer: React.FC = () => {
  const { areas } = useLocation();
  const { user } = useAuth();
  const { pathname } = useRouterLocation();
  if (NO_FOOTER.includes(pathname)) return null;
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div>
            <h3>About Becho</h3>
            <p>Peer-to-peer classifieds for buying and selling pre-loved goods in your city. Chat, agree a price and deal in person.</p>
            <p className="muted" style={{ fontSize: '0.8rem', marginTop: 12 }}>© {new Date().getFullYear()} Becho</p>
          </div>
          {areas.length > 0 && (
            <div>
              <h3>Popular cities</h3>
              <ul>
                {areas.slice(0, 6).map((a) => <li key={a.id}><Link to={`/browse?city=${a.cityCode}`}>{a.cityName}</Link></li>)}
              </ul>
            </div>
          )}
          <div>
            <h3>Safe selling tips</h3>
            <ul className="plain">
              <li>Meet in busy public places</li>
              <li>Inspect items carefully in person</li>
              <li>Keep your conversation in Becho chat</li>
              <li>Pay only after you have checked the item</li>
            </ul>
          </div>
          <div>
            <h3>Help & support</h3>
            <ul>
              <li><Link to="/browse">Browse all listings</Link></li>
              <li><Link to="/create-listing">Post an ad</Link></li>
              {user ? <li><Link to="/account">My account</Link></li> : <li><Link to="/login">Sign in</Link></li>}
              <li><Link to="/forgot-password">Reset your password</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-strip">
          <span><BadgeCheck size={18} /> Free to post · Verified accounts · Deal directly, in person</span>
          <span className="muted">Buy & sell locally</span>
        </div>
      </div>
    </footer>
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
            <span className="brand-mark" aria-hidden="true">B</span>
            <span className="brand-text">
              <span className="brand-name">Becho</span>
              <span className="brand-tag">Buy & Sell Locally</span>
            </span>
          </Link>
          <span className="brand-sep desktop-only" aria-hidden="true" />
          <LocationSelector />
          <TopSearch />

          <div className="topbar-right">
            {user ? (
              <>
                <NavLink to="/favorites" className={({ isActive }) => `icon-btn topbar-icon desktop-only${isActive ? ' active' : ''}`} title="Saved ads" aria-label="Saved ads">
                  <Heart size={20} />
                </NavLink>
                <NavLink to="/chat" className={({ isActive }) => `icon-btn topbar-icon desktop-only${isActive ? ' active' : ''}`} title="Messages" aria-label={chatBadge > 0 ? `Messages, ${chatBadge} unread` : 'Messages'}>
                  <MessageSquare size={20} />
                  {chatBadge > 0 && <span className="badge-dot primary">{chatBadge > 9 ? '9+' : chatBadge}</span>}
                </NavLink>
                <NotificationBell />
                <AccountMenu />
                <Link to="/create-listing" className="btn-primary desktop-only" style={{ minHeight: 40 }}>
                  <Plus size={18} /> Post an Ad
                </Link>
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
        <CategoryNav />

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
