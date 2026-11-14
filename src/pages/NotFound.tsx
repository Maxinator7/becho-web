import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL as string | undefined;

/** Old /admin links go to the separate admin portal. */
export const AdminRedirect: React.FC = () => {
  useEffect(() => {
    if (ADMIN_URL) window.location.replace(ADMIN_URL);
  }, []);
  return (
    <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
      {ADMIN_URL ? 'Opening the admin portal…' : 'The admin portal has moved to its own address.'}
    </div>
  );
};

export const NotFound: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', fontWeight: 800 }} className="gradient-text">404</div>
        <h1 style={{ fontSize: '1.5rem', margin: '0.5rem 0' }}>Page not found</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          There's nothing at <code>{pathname}</code>. The listing may have been removed or the link is wrong.
        </p>
        <Link to="/browse" className="btn-primary">Browse listings</Link>
      </div>
    </div>
  );
};
