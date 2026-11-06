import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { LocationSelector } from '../../components/LocationSelector';
import { ShoppingBag, ShieldCheck, MessageSquare, ArrowRight, User, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HealthResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
}

export const Home: React.FC = () => {
  const [apiStatus, setApiStatus] = useState<string>('Checking...');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchApi<HealthResponse>('/health').then((res) => {
      if (res.success && res.data) {
        setApiStatus(`Connected (${res.data.service} v${res.data.version})`);
      } else {
        setApiStatus('API Disconnected');
      }
    });
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header / Nav */}
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>
          <span className="gradient-text">BECHO</span> Marketplace
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <LocationSelector />
          <Link to="/browse" style={{ color: 'var(--text-secondary)' }}>Browse</Link>
          <Link to="/admin" style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>Admin Panel</Link>
          {user ? (
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link to="/my-listings" style={{ color: 'var(--text-secondary)' }}>My Listings</Link>
              <Link to="/create-listing" className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>+ Sell Item</Link>
              <span style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <User size={16} /> {user.displayName}
              </span>
              <button onClick={logout} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/login" style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: '6px' }}>
                Register
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Banner */}
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid var(--accent-primary)', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
          Phase 0 — Modular Monolith API Status: <strong>{apiStatus}</strong>
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
          Buy & Sell Smart with <span className="gradient-text">Verified Trust</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          The verified hyper-local marketplace. Attribute-based dynamic dynamic listings, automated sanitization, and structured negotiation.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/browse" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Explore Marketplace <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <ShieldCheck size={36} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Automated Sanitization</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Every listing passes thorough multi-check automated moderation before going live.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <ShoppingBag size={36} color="var(--accent-secondary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Dynamic Attributes</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Category-specific properties ensure accurate listings and powerful faceted search.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <MessageSquare size={36} color="#ec4899" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Structured Negotiation</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            In-app chat paired with explicit offer & counteroffer audit trails.
          </p>
        </div>
      </div>
    </div>
  );
};
