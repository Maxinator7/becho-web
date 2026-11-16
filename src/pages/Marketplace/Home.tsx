import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Building2, Check, ChevronDown, Handshake, ImagePlus, LayoutGrid, MapPin, Search,
  SlidersHorizontal, Tag, Users, Zap,
} from 'lucide-react';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import {
  EmptyState, ListingCard, ListingCardData, categoryIcon, shortCategoryName, useCategories, useFavoriteIds,
} from '../../components/ui';
import { useLocation } from '../../context/LocationContext';

type FeedFilter = 'all' | 'verified' | 'under10k';
const FEED_FILTERS: { key: FeedFilter; label: string; query: string }[] = [
  { key: 'all', label: 'All items', query: '' },
  { key: 'verified', label: 'Verified by Becho', query: '&verified=true' },
  { key: 'under10k', label: 'Price under ₹10,000', query: '&maxPrice=10000' },
];

const TRUST = [
  { Icon: BadgeCheck, title: 'Verified accounts', text: 'Every member confirms their email or mobile number with a one-time code before they can sell or chat.' },
  { Icon: Handshake, title: 'Zero commission, direct deals', text: 'Becho takes no cut. The price you agree stays between buyer and seller.' },
  { Icon: MapPin, title: 'Meet and inspect locally', text: 'Deal with people in your own city, check the item in person, then pay.' },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { areas, selectedArea, setSelectedArea } = useLocation();
  const categories = useCategories();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const [query, setQuery] = useState('');
  const [heroCat, setHeroCat] = useState('');
  const [feed, setFeed] = useState<FeedFilter>('all');
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const city = selectedArea ? `&countryCode=${selectedArea.countryCode}&cityCode=${selectedArea.cityCode}` : '';
    const extra = FEED_FILTERS.find((f) => f.key === feed)?.query ?? '';
    let live = true;
    setLoading(true);
    fetchApi<{ listings: ListingCardData[]; pagination: { total: number } }>(`/listings?sort=newest&limit=8${city}${extra}`).then((res) => {
      if (!live) return;
      setLoading(false);
      if (res.success && res.data) {
        setListings(res.data.listings ?? []);
        setTotal(res.data.pagination?.total ?? null);
      } else {
        setListings([]);
        setTotal(null);
      }
    });
    return () => { live = false; };
  }, [selectedArea, feed]);

  const where = selectedArea ? selectedArea.cityName : 'your area';
  const browseLink = () => {
    const p = new URLSearchParams();
    if (feed === 'verified') p.set('verified', 'true');
    if (feed === 'under10k') p.set('maxPrice', '10000');
    const qs = p.toString();
    return qs ? `/browse?${qs}` : '/browse';
  };
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (heroCat) p.set('categoryId', heroCat);
    if (query.trim()) p.set('search', query.trim());
    const qs = p.toString();
    navigate(qs ? `/browse?${qs}` : '/browse');
  };
  const pickCity = (code: string) => {
    setSelectedArea(areas.find((a) => a.cityCode === code) ?? null);
  };

  return (
    <>
      <Navbar />
      <main className="page home-stack home-v2">
        {/* ── desktop hero ── */}
        <section className="hero desktop-only" aria-labelledby="hero-title">
          <span className="hero-overline"><span className="dot" /> Neighbourhood classifieds</span>
          <h1 id="hero-title">Buy & sell pre-loved goods in your neighbourhood</h1>
          <p className="hero-sub">Direct, person-to-person trading. Find phones, electronics, vehicles, furniture and everyday essentials from people in your city.</p>
          <form className="hero-search" role="search" onSubmit={search}>
            <label className="hero-field">
              <MapPin size={18} />
              <span className="hf-text">
                <span className="hf-label">City</span>
                <select value={selectedArea?.cityCode ?? ''} onChange={(e) => pickCity(e.target.value)} aria-label="City">
                  <option value="">All cities</option>
                  {areas.map((a) => <option key={a.id} value={a.cityCode}>{a.cityName}</option>)}
                </select>
              </span>
              <ChevronDown size={16} className="hf-caret" />
            </label>
            <label className="hero-field">
              <LayoutGrid size={18} />
              <span className="hf-text">
                <span className="hf-label">Category</span>
                <select value={heroCat} onChange={(e) => setHeroCat(e.target.value)} aria-label="Category">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </span>
              <ChevronDown size={16} className="hf-caret" />
            </label>
            <label className="hero-field grow">
              <Search size={18} />
              <span className="sr-only">Search listings</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by model, brand or item" />
            </label>
            <button type="submit" className="btn-primary hero-go">Find deals <ArrowRight size={18} /></button>
          </form>
          <div className="hero-sell">
            <span className="hs-icon"><Zap size={18} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hs-title">Got items you no longer use?</div>
              <div className="muted" style={{ fontSize: '0.82rem' }}>Post an ad in a few minutes. Posting is free.</div>
            </div>
            <Link to="/create-listing" className="btn btn-soft btn-sm">Post listing for free <ArrowRight size={15} /></Link>
          </div>
        </section>

        {/* ── mobile search + city pills ── */}
        <section className="mobile-only">
          <div style={{ display: 'flex', gap: 8 }}>
            <form role="search" onSubmit={search} className="searchbar" style={{ flex: 1 }}>
              <Search size={20} />
              <label htmlFor="home-search" className="sr-only">Search listings</label>
              <input id="home-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search phones, bikes, laptops, sofas…" />
            </form>
            <Link to="/browse?filters=1" className="icon-btn bordered filter-btn" aria-label="Filters" title="Filters"><SlidersHorizontal size={20} /></Link>
          </div>
          {areas.length > 0 && (
            <div className="pill-row" role="group" aria-label="City" style={{ marginTop: '12px' }}>
              <button type="button" className={`pill${!selectedArea ? ' active' : ''}`} aria-pressed={!selectedArea} onClick={() => setSelectedArea(null)}>
                All cities {!selectedArea && <Check size={14} />}
              </button>
              {areas.map((a) => {
                const on = selectedArea?.id === a.id;
                return (
                  <button key={a.id} type="button" className={`pill${on ? ' active' : ''}`} aria-pressed={on} onClick={() => setSelectedArea(a)}>
                    {a.cityName} {on && <Check size={14} />}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── trust ── */}
        <section className="trust-cards desktop-only" aria-label="Why Becho">
          {TRUST.map(({ Icon, title, text }) => (
            <div key={title} className="trust-card">
              <span className="tc-icon"><Icon size={22} /></span>
              <div>
                <div className="tc-title">{title}</div>
                <div className="tc-text">{text}</div>
              </div>
            </div>
          ))}
        </section>
        <section className="trust-mini mobile-only" aria-label="Why Becho">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tm-title">Trust in every deal</div>
            <div className="tm-text">Buy and sell locally with verified community members.</div>
            <Link to="/browse?verified=true" className="link tm-link">Verified listings <ArrowRight size={15} /></Link>
          </div>
          <span className="tm-icon"><Users size={20} /></span>
        </section>

        {/* ── categories ── */}
        {categories.length > 0 && (
          <section aria-labelledby="home-cats">
            <div className="section-head">
              <div>
                <div className="overline desktop-only">Categories</div>
                <h2 id="home-cats" className="section-title big">Explore by category</h2>
              </div>
              <Link to="/browse" className="link" style={{ fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <span className="desktop-only">View all listings</span><span className="mobile-only">See all</span> <ArrowRight size={15} className="desktop-only" />
              </Link>
            </div>
            <div className="cat-cards">
              {categories.map((c) => {
                const Icon = categoryIcon(c.slug);
                const subs = (c.children ?? []).map((ch) => ch.name).join(', ');
                return (
                  <Link key={c.id} to={`/browse?categoryId=${c.id}`} className="cat-card" title={c.name}>
                    <span className="cc-icon"><Icon size={22} /></span>
                    <span className="cc-name"><span className="desktop-only">{c.name}</span><span className="mobile-only">{shortCategoryName(c.name)}</span></span>
                    {subs && <span className="cc-subs desktop-only">{subs}</span>}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="sell-banner mobile-only">
          <span className="sb-icon"><ImagePlus size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-title">Looking to sell?</div>
            <div className="muted" style={{ fontSize: '0.82rem' }}>Post your ad in a few minutes</div>
          </div>
          <Link to="/create-listing" className="btn-primary btn-sm">Post Ad</Link>
        </section>

        {/* ── feed ── */}
        <section aria-labelledby="home-fresh">
          <div className="section-head feed-head">
            <div>
              <div className="overline desktop-only">Live local feed</div>
              <h2 id="home-fresh" className="section-title big">Fresh recommendations</h2>
            </div>
            <span className="muted mobile-only" style={{ fontSize: '0.82rem' }}>{selectedArea ? selectedArea.cityName : 'All cities'}</span>
            <div className="pill-row feed-pills" role="group" aria-label="Filter recommendations">
              {FEED_FILTERS.map((f) => (
                <button key={f.key} type="button" className={`pill${feed === f.key ? ' active' : ''}`} aria-pressed={feed === f.key} onClick={() => setFeed(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>Loading listings…</div>
          ) : listings.length === 0 ? (
            <EmptyState icon={<Tag size={24} />} title={feed === 'all' ? `Nothing listed in ${where} yet` : 'No listings match this filter'} action={feed === 'all' ? <Link to="/create-listing" className="btn-primary">Sell something</Link> : <button type="button" className="btn btn-outline" onClick={() => setFeed('all')}>Show all items</button>}>
              {feed === 'all' ? 'Be the first to post an item here, or try another city.' : `Try another filter or city.`}
            </EmptyState>
          ) : (
            <>
              <div className="listing-grid">
                {listings.map((item) => (
                  <ListingCard key={item.id} item={item} favorited={favoriteIds.has(item.id)} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
              {total !== null && total > listings.length && (
                <Link to={browseLink()} className="btn btn-outline btn-block btn-lg" style={{ marginTop: '20px' }}>
                  Show all {total} listings <ChevronDown size={18} />
                </Link>
              )}
            </>
          )}
        </section>

        {/* ── cities ── */}
        {areas.length > 0 && (
          <section className="nearby desktop-only" aria-labelledby="home-nearby">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="overline"><Building2 size={14} /> Local classifieds</div>
              <h2 id="home-nearby">Looking for deals nearby?</h2>
              <p>Pick your city and chat directly with buyers and sellers near you.</p>
            </div>
            <div className="nearby-cities">
              {areas.map((a) => (
                <Link key={a.id} to={`/browse?city=${a.cityCode}`} className={`city-chip${selectedArea?.id === a.id ? ' on' : ''}`}>{a.cityName}</Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
};
