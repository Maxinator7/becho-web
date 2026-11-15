import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { EmptyState, ListingCard, ListingCardData } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

type FavoriteListing = ListingCardData & { stateCode?: string; seller?: { displayName: string } };

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

  const handleRemoveFavorite = async (id: string) => {
    const res = await fetchApi<{ favorited: boolean }>(`/favorites/${id}`, { method: 'POST' });
    if (res.success) {
      setListings((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <>
      <Navbar title="Saved ads" />
      <main className="page">
        <div style={{ marginBottom: '16px' }}>
          <div className="overline">Your shortlist</div>
          <h1 className="page-title">Saved ads <span className="muted" style={{ fontWeight: 600 }}>({listings.length})</span></h1>
        </div>

        {loading ? (
          <div className="muted" style={{ padding: '48px 0', textAlign: 'center' }}>Loading saved ads…</div>
        ) : listings.length === 0 ? (
          <EmptyState icon={<Heart size={24} />} title="No saved ads yet" action={<Link to="/browse" className="btn-primary">Explore listings</Link>}>
            Tap the heart on any listing to keep it here.
          </EmptyState>
        ) : (
          <div className="listing-grid">
            {listings.map((item) => (
              <ListingCard key={item.id} item={item} favorited onToggleFavorite={handleRemoveFavorite} />
            ))}
          </div>
        )}
      </main>
    </>
  );
};
