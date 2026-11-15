import React from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { ExternalLink, LayoutDashboard, ListChecks, LogOut, MapPin, Package, Shield, Users } from 'lucide-react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { AdminLogin, STAFF_ROLES } from './Login';
import { Button, Loading, Pill, ToastProvider } from './ui';
import { OverviewPage } from './pages/Overview';
import { ReviewQueuePage } from './pages/ReviewQueue';
import { ListingsPage } from './pages/Listings';
import { ListingDetailPage } from './pages/ListingDetail';
import { UsersPage } from './pages/Users';
import { UserDetailPage } from './pages/UserDetail';
import { ServiceAreasPage } from './pages/ServiceAreas';

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL as string | undefined;

const NAV = [
  { to: '/', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/queue', label: 'Review queue', Icon: ListChecks },
  { to: '/listings', label: 'Listings', Icon: Package },
  { to: '/users', label: 'Users', Icon: Users },
  { to: '/service-areas', label: 'Service areas', Icon: MapPin },
];

const Brand: React.FC = () => (
  <div className="adm-brand">
    <Shield size={20} color="var(--accent-primary)" /> <span className="gradient-text">BECHO</span> Admin
  </div>
);

const AdminShell: React.FC = () => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <Loading />;
  if (!user) return <AdminLogin />;
  if (!STAFF_ROLES.includes(user.role)) {
    return (
      <div style={{ maxWidth: '420px', margin: '6rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <p style={{ marginBottom: '1rem' }}>This account does not have access to the admin portal.</p>
        <Button variant="primary" onClick={logout}>Sign out</Button>
      </div>
    );
  }

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <Brand />
        <nav className="adm-nav" aria-label="Admin sections">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={17} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="adm-main">
        <header className="adm-topbar">
          <Brand />
          {MARKETPLACE_URL && (
            <a href={MARKETPLACE_URL} target="_blank" rel="noreferrer" className="adm-hide-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Marketplace <ExternalLink size={13} />
            </a>
          )}
          <ThemeToggle />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <span className="adm-hide-sm" style={{ fontWeight: 600 }}>{user.displayName}</span>
            <Pill tone={user.role === 'ADMIN' ? 'accent' : 'info'}>{user.role === 'ADMIN' ? 'Admin' : 'Moderator'}</Pill>
          </span>
          <button onClick={logout} className="adm-btn" title="Sign out" aria-label="Sign out" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
            <LogOut size={17} />
          </button>
        </header>
        <main className="adm-content">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/queue" element={<ReviewQueuePage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />
            <Route path="/service-areas" element={<ServiceAreasPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const AdminApp: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AdminShell />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  </ThemeProvider>
);
