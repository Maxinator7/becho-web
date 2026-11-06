import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { ShoppingBag, PlusCircle } from 'lucide-react';

interface ListingItem {
  id: string;
  title: string;
  price: number;
  status: string;
  createdAt: string;
  category?: { name: string };
  media?: { url: string }[];
}

export const MyListings: React.FC = () => {
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<ListingItem[]>('/listings/mine')
      .then((res) => {
        if (res.success && res.data) {
          setListings(res.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link to="/" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
          <span className="gradient-text">BECHO</span> Marketplace
        </Link>
        <Link to="/create-listing" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
          <PlusCircle size={16} /> Post New Listing
        </Link>
      </nav>

      <h1 style={{ marginBottom: '1.5rem' }}>My Seller Listings</h1>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading your listings...</p>
      ) : listings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <ShoppingBag size={48} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Listings Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You haven't posted any marketplace listings yet.</p>
          <Link to="/create-listing" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>Post Your First Item</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {listings.map((item) => (
            <div key={item.id} className="glass-panel" style={{ padding: '1.25rem', overflow: 'hidden' }}>
              {item.media && item.media.length > 0 ? (
                <img
                  src={item.media[0].url}
                  alt={item.title}
                  style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }}
                />
              ) : (
                <div style={{ width: '100%', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  No Image
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.title}</h3>
                <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: item.status === 'LIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: item.status === 'LIVE' ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                  {item.status}
                </span>
              </div>

              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>
                ${item.price.toFixed(2)}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                <span>Category: {item.category?.name || 'General'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
