import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ShieldCheck, MessageSquare, ArrowRight, PlusCircle } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';

export const Home: React.FC = () => {
  const { user } = useAuth();

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />

      {/* Hero Banner */}
      <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', marginBottom: '3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid var(--accent-primary)', borderRadius: '20px', fontSize: '0.85rem', color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>
          Now live in Mumbai, Pune, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata and Ahmedabad
        </div>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 }}>
          Buy & sell locally with <span className="gradient-text">verified people</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
          Every seller is phone-verified, every listing is checked before it goes live, and you can make and negotiate offers right in the chat.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/browse" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Explore listings <ArrowRight size={18} />
          </Link>
          <Link
            to={user ? '/create-listing' : '/register'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', fontWeight: 600 }}
          >
            <PlusCircle size={18} /> Sell something
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <ShieldCheck size={36} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Checked listings</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Every listing is screened automatically, and anything suspicious is reviewed by our team before buyers see it.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <ShoppingBag size={36} color="var(--accent-secondary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Find exactly what you want</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Filter by city, category, condition and price, with details like brand and model for each category.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <MessageSquare size={36} color="#ec4899" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Chat and negotiate</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Message sellers, make offers and counter-offers, and get notified the moment someone replies.
          </p>
        </div>
      </div>
    </div>
  );
};
