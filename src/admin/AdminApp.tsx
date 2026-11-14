import React, { useState } from 'react';
import { Shield, LogOut, AlertCircle, ExternalLink } from 'lucide-react';
import { AuthTokens, fetchApi } from '../api/client';
import { AuthProvider, UserProfile, useAuth } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { AdminDashboard } from './Dashboard';

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL as string | undefined;
const STAFF_ROLES = ['ADMIN', 'MODERATOR'];

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)',
  border: '1px solid var(--input-border)', color: 'var(--input-text)', fontSize: '0.95rem',
};

/** Staff-only sign in. Regular accounts are turned away even with a correct password. */
const AdminLogin: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetchApi<{ tokens: AuthTokens; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.message || 'Sign in failed');
      return;
    }
    if (!STAFF_ROLES.includes(res.data.user.role)) {
      setError('This account does not have access to the admin portal.');
      return;
    }
    login(res.data.tokens, res.data.user);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '6rem auto', padding: '0 1rem' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <Shield size={36} color="var(--accent-primary)" />
        </div>
        <h1 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.25rem' }}>Becho Admin</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Staff sign in</p>
        {error && (
          <div role="alert" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Email
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...inputStyle, marginTop: '0.35rem' }} />
          </label>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginTop: '0.35rem' }} />
          </label>
          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '0.8rem', marginTop: '0.5rem' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AdminShell: React.FC = () => {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>;
  if (!user) return <AdminLogin />;
  if (!STAFF_ROLES.includes(user.role)) {
    return (
      <div style={{ maxWidth: '420px', margin: '6rem auto', textAlign: 'center', padding: '0 1rem' }}>
        <p style={{ marginBottom: '1rem' }}>This account does not have access to the admin portal.</p>
        <button onClick={logout} className="btn-primary">Sign out</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <nav className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800, fontSize: '1.15rem' }}>
          <Shield size={20} color="var(--accent-primary)" /> <span className="gradient-text">BECHO</span> Admin
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {MARKETPLACE_URL && (
            <a href={MARKETPLACE_URL} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Marketplace <ExternalLink size={13} />
            </a>
          )}
          <ThemeToggle />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{user.displayName} · {user.role.toLowerCase()}</span>
          <button onClick={logout} title="Sign out" aria-label="Sign out" style={{ color: 'var(--text-secondary)', display: 'flex' }}>
            <LogOut size={17} />
          </button>
        </div>
      </nav>
      <AdminDashboard />
    </div>
  );
};

export const AdminApp: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <AdminShell />
    </AuthProvider>
  </ThemeProvider>
);
