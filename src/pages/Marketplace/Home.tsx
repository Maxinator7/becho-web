import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Navigation, Search, ShieldCheck, SlidersHorizontal, Sparkles, Check, Tag } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { EmptyState, ListingCard, ListingCardData, categoryIcon, shortCategoryName, useFavoriteIds } from '../../components/ui';
import { useLocation } from '../../context/LocationContext';

interface CategoryNode { id: string; name: string; slug: string }

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { areas, selectedArea, setSelectedArea } = useLocation();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<CategoryNode[]>('/categories').then((res) => { if (res.success && res.data) setCategories(res.data); });
  }, []);

  useEffect(() => {
    const city = selectedArea ? `&countryCode=${selectedArea.countryCode}&cityCode=${selectedArea.cityCode}` : '';
    setLoading(true);
    fetchApi<{ listings: ListingCardData[]; pagination: { total: number } }>(`/listings?sort=newest&limit=8${city}`).then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setListings(res.data.listings ?? []);
        setTotal(res.data.pagination?.total ?? null);
      }
    });
    fetchApi<{ pagination: { total: number } }>(`/listings?verified=true&limit=1${city}`).then((res) => {
      setVerifiedCount(res.success && res.data ? res.data.pagination?.total ?? null : null);
    });
  }, [selectedArea]);

  const where = selectedArea ? selectedArea.cityName : 'your area';
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(query.trim() ? `/browse?search=${encodeURIComponent(query.trim())}` : '/browse');
  };

  return (
    <>
      <Navbar />
      <main className="page home-stack">
        <section>
          <h1 className="page-title desktop-only" style={{ fontSize: '1.9rem', marginBottom: '6px' }}>
            Buy & sell locally with verified people
          </h1>
          <p className="secondary desktop-only" style={{ marginBottom: '16px' }}>
            Every listing is screened before it goes live, and you can negotiate offers right in the chat.
          </p>
          <form role="search" onSubmit={search} className="searchbar" style={{ maxWidth: '720px' }}>
            <Search size={20} />
            <label htmlFor="home-search" className="sr-only">Search listings</label>
            <input id="home-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search phones, bikes, sofas, MacBooks…" />
            <Link to="/browse?filters=1" className="icon-btn" aria-label="Filters" title="Filters"><SlidersHorizontal size={18} /></Link>
          </form>

          {areas.length > 0 && (
            <div className="pill-row" role="group" aria-label="City" style={{ marginTop: '12px' }}>
              <button type="button" className={`pill${!selectedArea ? ' active' : ''}`} aria-pressed={!selectedArea} onClick={() => setSelectedArea(null)}>
                All cities
              </button>
              {areas.map((a) => {
                const on = selectedArea?.id === a.id;
                return (
                  <button key={a.id} type="button" className={`pill${on ? ' active' : ''}`} aria-pressed={on} onClick={() => setSelectedArea(a)}>
                    {on && <Navigation size={14} />} {a.cityName} {on && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="trust-banner" aria-label="Why Becho">
          <span className="shield"><ShieldCheck size={22} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Verified people only</div>
            <div className="secondary" style={{ fontSize: '0.82rem', lineHeight: 1.4 }}>
              Accounts are verified and every listing is screened before it goes live.
            </div>
          </div>
          <Link to="/browse?verified=true" className="link" style={{ fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            Verified ads <ChevronRight size={16} />
          </Link>
        </section>

        {categories.length > 0 && (
          <section aria-labelledby="home-cats">
            <div className="section-head">
              <h2 id="home-cats" className="section-title">Browse categories</h2>
              <Link to="/browse" className="link" style={{ fontSize: '0.85rem' }}>Explore all</Link>
            </div>
            <div className="cat-grid">
              {categories.map((c) => {
                const Icon = categoryIcon(c.slug);
                return (
                  <Link key={c.id} to={`/browse?categoryId=${c.id}`} className="cat-tile" title={c.name}>
                    <span className="cat-icon"><Icon size={20} /></span>
                    <span className="cat-label">{shortCategoryName(c.name)}</span>
                  </Link>
                );
              })}
              <Link to="/browse" className="cat-tile">
                <span className="cat-icon"><Tag size={20} /></span>
                <span className="cat-label">All items</span>
              </Link>
            </div>
          </section>
        )}

        {verifiedCount !== null && verifiedCount > 0 && (
          <section className="promo-card">
            <div style={{ minWidth: 0 }}>
              <div className="overline"><Sparkles size={14} /> Verified near you</div>
              <h3>Staff-verified listings in {where}</h3>
              <p>{verifiedCount} listing{verifiedCount === 1 ? '' : 's'} checked by the Becho team</p>
            </div>
            <Link to="/browse?verified=true" className="btn-primary btn-sm" style={{ flexShrink: 0 }}>View all</Link>
          </section>
        )}

        <section aria-labelledby="home-fresh">
          <div className="section-head">
            <div>
              <h2 id="home-fresh" className="section-title">Fresh in {where}</h2>
              <div className="muted" style={{ fontSize: '0.8rem' }}>The newest listings from people near you</div>
            </div>
            <span className="muted" style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>Sort: <strong style={{ color: 'var(--text-primary)' }}>Newest</strong></span>
          </div>
          {loading ? (
            <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>Loading listings…</div>
          ) : listings.length === 0 ? (
            <EmptyState icon={<Tag size={24} />} title={`Nothing listed in ${where} yet`} action={<Link to="/create-listing" className="btn-primary">Sell something</Link>}>
              Be the first to post an item here, or try another city.
            </EmptyState>
          ) : (
            <>
              <div className="listing-grid">
                {listings.map((item) => (
                  <ListingCard key={item.id} item={item} favorited={favoriteIds.has(item.id)} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
              {total !== null && total > listings.length && (
                <Link to="/browse" className="btn btn-outline btn-block btn-lg" style={{ marginTop: '16px' }}>
                  Show more in {where} <ChevronDown size={18} />
                </Link>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
};
