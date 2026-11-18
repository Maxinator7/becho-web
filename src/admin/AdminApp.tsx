import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ChevronRight, ExternalLink, LayoutDashboard, ListChecks, LogOut, MapPin, MessageSquarePlus, MessagesSquare, Package, Users } from 'lucide-react';
import { fetchApi } from '../api/client';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { AdminThemeToggle, BrandMark } from './chrome';
import { AdminLogin, STAFF_ROLES } from './Login';
import { Button, Loading, ToastProvider, initials } from './ui';
import { GlobalSearch } from './GlobalSearch';
import { OverviewPage } from './pages/Overview';
import { ReviewQueuePage } from './pages/ReviewQueue';
import { ListingsPage } from './pages/Listings';
import { ListingDetailPage } from './pages/ListingDetail';
import { UsersPage } from './pages/Users';
import { ServiceAreasPage } from './pages/ServiceAreas';
import { FeedbackPage } from './pages/Feedback';
import { BetaBanner, BetaProvider, useBeta, type PrivacyLink } from '../feedback/Beta';

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL as string | undefined;
/** The beta terms & privacy page lives on the marketplace. */
const PRIVACY_BASE = MARKETPLACE_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : undefined);
const privacyLink: PrivacyLink | undefined = PRIVACY_BASE
  ? (className, children) => <a href={`${PRIVACY_BASE}/privacy`} target="_blank" rel="noreferrer" className={className}>{children}</a>
  : undefined;

const NAV = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/queue', label: 'Review queue', Icon: ListChecks, badge: 'queue' as const },
  { to: '/listings', label: 'Listings', Icon: Package },
  { to: '/users', label: 'Users', Icon: Users },
  { to: '/feedback', label: 'Feedback', Icon: MessagesSquare, badge: 'feedback' as const },
];
const NAV_CONFIG = [{ to: '/service-areas', label: 'Service areas', Icon: MapPin }];

const Brand: React.FC = () => (
  <div className="a-brand">
    <BrandMark />
    <div className="a-brand__text">
      <div className="a-brand__name">Becho</div>
      <div className="a-brand__sub">Admin operations</div>
    </div>
  </div>
);

/** Size of the review queue for the sidebar badge; refreshes on navigation and after moderation actions. */
function useQueueCount(): number | null {
  const location = useLocation();
  const [count, setCount] = useState<number | null>(null);
  const load = useCallback(() => {
    fetchApi<unknown[]>('/admin/moderation/queue').then((res) => {
      if (res.success && Array.isArray(res.data)) setCount(res.data.length);
    });
  }, []);
  useEffect(load, [load, location.pathname]);
  useEffect(() => {
    window.addEventListener('adm:queue-changed', load);
    return () => window.removeEventListener('adm:queue-changed', load);
  }, [load]);
  return count;
}

/** Feedback still marked NEW, for the sidebar badge. */
function useNewFeedbackCount(): number | null {
  const location = useLocation();
  const [count, setCount] = useState<number | null>(null);
  const load = useCallback(() => {
    fetchApi<{ summary: { byStatus: Record<string, number> } }>('/admin/feedback?limit=1').then((res) => {
      if (res.success && res.data) setCount(res.data.summary.byStatus.NEW ?? 0);
    });
  }, []);
  useEffect(load, [load, location.pathname]);
  useEffect(() => {
    window.addEventListener('adm:feedback-changed', load);
    return () => window.removeEventListener('adm:feedback-changed', load);
  }, [load]);
  return count;
}

function crumbFor(pathname: string): string[] {
  if (pathname === '/') return ['Overview'];
  if (pathname.startsWith('/queue')) return ['Review queue'];
  if (/^\/listings\/.+/.test(pathname)) return ['Listings', 'Listing review'];
  if (pathname.startsWith('/listings')) return ['Listings'];
  if (/^\/users\/.+/.test(pathname)) return ['Users', 'Profile'];
  if (pathname.startsWith('/users')) return ['Users'];
  if (pathname.startsWith('/service-areas')) return ['Service areas'];
  if (pathname.startsWith('/feedback')) return ['Beta feedback'];
  return [];
}

const AdminShell: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loading />;
  if (!user) return <><BetaBanner /><AdminLogin /></>;
  if (!STAFF_ROLES.includes(user.role)) {
    return (
      <div style={{ maxWidth: 420, margin: '6rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <p style={{ marginBottom: '1rem' }}>This account does not have access to the admin portal.</p>
        <Button variant="primary" onClick={logout}>Sign out</Button>
      </div>
    );
  }

  return <StaffShell crumbs={crumbFor(location.pathname)} />;
};

const StaffShell: React.FC<{ crumbs: string[] }> = ({ crumbs }) => {
  const { user, logout } = useAuth();
  const queueCount = useQueueCount();
  const feedbackCount = useNewFeedbackCount();
  const { openFeedback } = useBeta();
  if (!user) return null;
  const roleLabel = user.role === 'ADMIN' ? 'Admin' : 'Moderator';

  const link = ({ to, label, Icon, end, badge }: { to: string; label: string; Icon: typeof Users; end?: boolean; badge?: 'queue' | 'feedback' }) => {
    const n = badge === 'queue' ? queueCount : badge === 'feedback' ? feedbackCount : null;
    return (
      <NavLink key={to} to={to} end={end} className="a-side__link" title={label}>
        <Icon size={18} />
        <span className="a-side__text">{label}</span>
        {n != null && n > 0 && (
          <span className="a-side__badge" aria-label={badge === 'feedback' ? `${n} new` : `${n} waiting`}>{n > 99 ? '99+' : n}</span>
        )}
      </NavLink>
    );
  };

  return (
    <div className="a-shell">
      <aside className="a-side">
        <Brand />
        <div className="a-side__label">Core platform</div>
        <nav className="a-side__nav" aria-label="Admin sections">
          {NAV.map(link)}
          <div className="a-side__label" style={{ marginTop: 18 }}>Configuration</div>
          {NAV_CONFIG.map(link)}
        </nav>
        {MARKETPLACE_URL && (
          <div className="a-side__foot">
            <span>Signed in to the staff console</span>
            <a href={MARKETPLACE_URL} target="_blank" rel="noreferrer">Open marketplace <ExternalLink size={12} /></a>
          </div>
        )}
      </aside>
      <div className="a-main">
        <BetaBanner />
        <header className="a-header">
          <nav className="a-crumbs" aria-label="Breadcrumb">
            <span>Becho Admin</span>
            {crumbs.map((c, i) => (
              <React.Fragment key={c}>
                <ChevronRight size={14} />
                {i === crumbs.length - 1 ? <strong aria-current="page">{c}</strong> : <span>{c}</span>}
              </React.Fragment>
            ))}
          </nav>
          <GlobalSearch />
          <div className="a-header__right">
            <button type="button" className="a-iconbtn" onClick={openFeedback} title="Send beta feedback" aria-label="Send beta feedback">
              <MessageSquarePlus size={18} />
            </button>
            <AdminThemeToggle />
            <div className="a-staff">
              <div className="a-staff__text">
                <div className="a-staff__name">{user.displayName}</div>
                <div className="a-staff__role">{roleLabel}</div>
              </div>
              <span className="a-avatar" aria-hidden title={`${user.displayName} · ${roleLabel}`}>{initials(user.displayName)}</span>
            </div>
            <button type="button" onClick={logout} className="a-iconbtn" title="Sign out" aria-label="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="a-content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/queue" element={<ReviewQueuePage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UsersPage />} />
            <Route path="/service-areas" element={<ServiceAreasPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const AdminApp: React.FC = () => (
  <div className="admin-root">
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <BetaProvider source="ADMIN" privacyLink={privacyLink}>
              <AdminShell />
            </BetaProvider>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  </div>
);
