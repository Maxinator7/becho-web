import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { Heart, MapPin } from 'lucide-react';

interface FavoriteListing {
  id: string;
  title: string;
  price: number;
  condition: string;
  cityCode: string;
  stateCode: string;
  category: { name: string };
  media: { url: string }[];
  seller: { displayName: string };
}

export const Favorites: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [listings, setListings] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchApi<FavoriteListing[]>('/favorites').then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setListings(res.data);
      }
    });
  }, [user, navigate]);

  const handleRemoveFavorite = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const res = await fetchApi<{ favorited: boolean }>(`/favorites/${id}`, { method: 'POST' });
    if (res.success) {
      setListings((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />

      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Heart color="#ef4444" fill="#ef4444" /> Favorited Items ({listings.length})
      </h1>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading favorites...</div>
      ) : listings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You haven't saved any listings yet.</p>
          <Link to="/browse" className="btn-primary" style={{ padding: '0.6rem 1.25rem', textDecoration: 'none' }}>
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {listings.map((item) => {
            const thumb = item.media && item.media.length > 0 ? item.media[0].url : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500';
            return (
              <Link
                key={item.id}
                to={`/listings/${item.id}`}
                className="glass-panel"
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                }}
              >
                <div style={{ position: 'relative', height: '180px' }}>
                  <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={(e) => handleRemoveFavorite(item.id, e)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      background: 'rgba(0,0,0,0.6)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    title="Remove from favorites"
                  >
                    <Heart size={18} color="#ef4444" fill="#ef4444" />
                  </button>
                </div>

                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {item.category?.name || 'General'}
                  </span>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: '1.4' }}>{item.title}</h3>
                  <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: 'auto', marginBottom: '0.75rem' }}>
                    ${item.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={14} color="var(--accent-secondary)" /> {item.cityCode}, {item.stateCode}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
