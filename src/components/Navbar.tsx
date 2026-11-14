import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LocationSelector } from './LocationSelector';
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { ShoppingBag, Heart, MessageSquare, PlusCircle, LogOut, User } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, isVerified } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
    <nav className="glass-panel" style={{ position: 'relative', zIndex: 50, padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/" style={{ fontSize: '1.35rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShoppingBag size={22} color="var(--accent-primary)" />
          <span className="gradient-text">BECHO</span>
        </Link>
        <LocationSelector />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <ThemeToggle />
        <Link to="/browse" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
          Browse
        </Link>

        {user ? (
          <>
            <Link to="/favorites" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
              <Heart size={18} color="#ef4444" /> Favorites
            </Link>

            <Link to="/chat" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
              <MessageSquare size={18} color="var(--accent-primary)" /> Messages
            </Link>

            <Link to="/my-listings" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
              My Listings
            </Link>

            <NotificationBell />

            <Link to="/create-listing" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}>
              <PlusCircle size={16} /> Sell Item
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-2)', padding: '0.35rem 0.75rem', borderRadius: '20px' }}>
              <User size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.displayName}</span>
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }} title="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              Sign In
            </Link>
            <Link to="/register" className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', textDecoration: 'none' }}>
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
    {user && !isVerified && (
      <div style={{ margin: '-1.25rem 0 1.5rem', padding: '0.65rem 1rem', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)', fontSize: '0.9rem' }}>
        Verify your account to sell, chat and make offers. <Link to="/verify" style={{ fontWeight: 700, textDecoration: 'underline' }}>Verify now</Link>
      </div>
    )}
    </>
  );
};
