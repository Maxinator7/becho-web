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
    <div className="muted" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
      {ADMIN_URL ? 'Opening the admin portal…' : 'The admin portal has moved to its own address.'}
    </div>
  );
};

export const NotFound: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <>
      <Navbar />
      <main className="page narrow">
        <div className="card empty-state" style={{ padding: '56px 20px' }}>
          <div className="overline">Error 404</div>
          <h1 className="page-title" style={{ margin: '6px 0 8px' }}>Page not found</h1>
          <p className="secondary" style={{ marginBottom: '20px', overflowWrap: 'anywhere' }}>
            There's nothing at <code>{pathname}</code>. The listing may have been removed or the link is wrong.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/browse" className="btn-primary">Explore listings</Link>
            <Link to="/" className="btn btn-outline">Go home</Link>
          </div>
        </div>
      </main>
    </>
  );
};
