import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useLocation } from '../../context/LocationContext';
import { Navbar } from '../../components/Navbar';
import { EmptyState, ListingCard, useFavoriteIds } from '../../components/ui';
import { Search, SlidersHorizontal, ChevronRight, ChevronLeft, ShieldCheck, Check, Navigation, X, SearchX } from 'lucide-react';

interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  children?: CategoryNode[];
}

interface ListingItem {
  id: string;
  title: string;
  price: number;
  condition: string;
  cityCode: string;
  stateCode: string;
  createdAt: string;
  category: { name: string; slug: string };
  media: { url: string }[];
  seller: { displayName: string };
  verifiedAt?: string | null;
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const Browse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedArea, areas, setSelectedArea } = useLocation();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const [showFilters, setShowFilters] = useState(searchParams.get('filters') === '1');

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: 12, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(searchParams.get('categoryId') || '');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') || '');
  const [minPrice, setMinPrice] = useState<string>(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState<string>(searchParams.get('maxPrice') || '');
  const [condition, setCondition] = useState<string>(searchParams.get('condition') || '');
  const [sortOrder, setSortOrder] = useState<string>(searchParams.get('sort') || 'newest');
  const [currentPage, setCurrentPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(searchParams.get('verified') === 'true');

  // Load categories
  useEffect(() => {
    fetchApi<CategoryNode[]>('/categories').then((res) => {
      if (res.success && res.data) {
        setCategories(res.data);
      }
    });
  }, []);

  // Fetch listings whenever filters change
  const loadListings = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedCategoryId) params.set('categoryId', selectedCategoryId);
    if (searchQuery) params.set('search', searchQuery);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (condition) params.set('condition', condition);
    if (sortOrder) params.set('sort', sortOrder);
    if (verifiedOnly) params.set('verified', 'true');
    params.set('page', String(currentPage));
    params.set('limit', '12');

    setSearchParams(params);
    // City comes from the navbar selector, not the URL.
    if (selectedArea) {
      params.set('countryCode', selectedArea.countryCode);
      params.set('cityCode', selectedArea.cityCode);
    }

    const res = await fetchApi<{ listings: ListingItem[]; pagination: PaginationInfo }>(`/listings?${params.toString()}`);
    setLoading(false);
    if (res.success && res.data) {
      setListings(res.data.listings || []);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    }
  };

  useEffect(() => {
    loadListings();
  }, [selectedCategoryId, searchQuery, minPrice, maxPrice, condition, sortOrder, verifiedOnly, currentPage, selectedArea]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadListings();
  };

  const handleClearFilters = () => {
    setSelectedCategoryId('');
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setSortOrder('newest');
    setVerifiedOnly(false);
    setCurrentPage(1);
  };

  const activeFilterCount = [minPrice, maxPrice, condition, verifiedOnly ? '1' : ''].filter(Boolean).length;

  return (
    <>
      <Navbar />
      <main className="page">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <div className="overline">Explore</div>
            <h1 className="page-title">{selectedArea ? `Listings in ${selectedArea.cityName}` : 'All listings'}</h1>
          </div>
          <div className="muted" style={{ fontSize: '0.85rem' }} aria-live="polite">
            {loading ? 'Searching…' : `${pagination.total} item${pagination.total !== 1 ? 's' : ''} available`}
          </div>
        </div>

        {/* Search */}
        <form role="search" onSubmit={handleSearchSubmit} className="searchbar">
          <Search size={20} />
          <label htmlFor="browse-search" className="sr-only">Search listings</label>
          <input
            id="browse-search"
            type="search"
            placeholder="Search by title, keyword, brand…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="browse-filters"
            aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'}
            title="Filters"
            style={activeFilterCount ? { background: 'var(--primary)', color: '#fff' } : undefined}
          >
            <SlidersHorizontal size={18} />
          </button>
        </form>

        {/* City + category rows */}
        {areas.length > 0 && (
          <div className="pill-row" role="group" aria-label="City" style={{ marginTop: '12px' }}>
            <button type="button" className={`pill${!selectedArea ? ' active' : ''}`} aria-pressed={!selectedArea} onClick={() => { setSelectedArea(null); setCurrentPage(1); }}>
              All cities
            </button>
            {areas.map((a) => {
              const on = selectedArea?.id === a.id;
              return (
                <button key={a.id} type="button" className={`pill${on ? ' active' : ''}`} aria-pressed={on} onClick={() => { setSelectedArea(a); setCurrentPage(1); }}>
                  {on && <Navigation size={14} />} {a.cityName} {on && <Check size={14} />}
                </button>
              );
            })}
          </div>
        )}
        {categories.length > 0 && (
          <div className="pill-row" role="group" aria-label="Category" style={{ marginTop: '8px', marginBottom: '18px' }}>
            <button type="button" className={`pill${!selectedCategoryId ? ' active' : ''}`} aria-pressed={!selectedCategoryId} onClick={() => { setSelectedCategoryId(''); setCurrentPage(1); }}>
              All categories
            </button>
            {categories.map((cat) => {
              const on = selectedCategoryId === cat.id || !!cat.children?.some((c) => c.id === selectedCategoryId);
              return (
                <button key={cat.id} type="button" className={`pill${on ? ' active' : ''}`} aria-pressed={on} onClick={() => { setSelectedCategoryId(cat.id); setCurrentPage(1); }}>
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="browse-layout">
          {/* Filters: a sidebar on desktop, a collapsible panel on phones */}
          <aside id="browse-filters" className={`browse-filters card card-pad${showFilters ? ' open' : ''}`} aria-label="Filters">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SlidersHorizontal size={18} color="var(--primary-text)" /> Filters
              </h2>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button type="button" onClick={handleClearFilters} className="btn btn-ghost btn-sm">Reset</button>
                <button type="button" onClick={() => setShowFilters(false)} className="icon-btn mobile-only" aria-label="Close filters" style={{ width: 32, height: 32 }}><X size={18} /></button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label htmlFor="browse-category" className="field-label">Category</label>
                <select
                  id="browse-category"
                  className="input"
                  value={selectedCategoryId}
                  onChange={(e) => { setSelectedCategoryId(e.target.value); setCurrentPage(1); }}
                >
                  <option value="">All categories</option>
                  {categories.map((cat) => (
                    <optgroup key={cat.id} label={cat.name}>
                      <option value={cat.id}>All in {cat.name}</option>
                      {cat.children?.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <span className="field-label" id="browse-price-label">Price range (₹)</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} role="group" aria-labelledby="browse-price-label">
                  <input type="number" inputMode="numeric" className="input" placeholder="Min" aria-label="Minimum price" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setCurrentPage(1); }} />
                  <span className="muted">–</span>
                  <input type="number" inputMode="numeric" className="input" placeholder="Max" aria-label="Maximum price" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>

              <div>
                <label htmlFor="browse-condition" className="field-label">Condition</label>
                <select id="browse-condition" className="input" value={condition} onChange={(e) => { setCondition(e.target.value); setCurrentPage(1); }}>
                  <option value="">Any condition</option>
                  <option value="NEW">Brand new</option>
                  <option value="LIKE_NEW">Like new</option>
                  <option value="USED">Used</option>
                  <option value="REFURBISHED">Refurbished</option>
                  <option value="FOR_PARTS">For parts</option>
                </select>
              </div>

              <label htmlFor="browse-verified" className="trust-banner" style={{ cursor: 'pointer', padding: '12px' }}>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <ShieldCheck size={16} color="var(--success)" /> Verified only
                  </span>
                  <span className="secondary" style={{ display: 'block', fontSize: '0.76rem' }}>Listings checked by the Becho team</span>
                </span>
                <input
                  id="browse-verified"
                  type="checkbox"
                  role="switch"
                  aria-checked={verifiedOnly}
                  checked={verifiedOnly}
                  onChange={(e) => { setVerifiedOnly(e.target.checked); setCurrentPage(1); }}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--success-fill)', flexShrink: 0 }}
                />
              </label>
            </div>
          </aside>

          <div className="browse-main">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h2 className="section-title" style={{ fontSize: '1rem' }}>{searchQuery ? <>Results for “{searchQuery}”</> : 'Newest first'}</h2>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }} className="muted">
                Sort
                <select
                  className="input"
                  value={sortOrder}
                  onChange={(e) => { setSortOrder(e.target.value); setCurrentPage(1); }}
                  style={{ minHeight: '36px', padding: '6px 32px 6px 10px', fontSize: '0.85rem', width: 'auto', fontWeight: 600, color: 'var(--text-primary)' }}
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </label>
            </div>

            {loading ? (
              <div className="muted" style={{ padding: '48px 0', textAlign: 'center' }}>Loading listings…</div>
            ) : listings.length === 0 ? (
              <EmptyState
                icon={<SearchX size={24} />}
                title="No listings found"
                action={<button type="button" onClick={handleClearFilters} className="btn-primary">Clear all filters</button>}
              >
                Try different keywords, another category or city, or a wider price range.
              </EmptyState>
            ) : (
              <>
                <div className="listing-grid">
                  {listings.map((item) => (
                    <ListingCard key={item.id} item={item} favorited={favoriteIds.has(item.id)} onToggleFavorite={toggleFavorite} />
                  ))}
                </div>

                {pagination.totalPages > 1 && (
                  <nav aria-label="Pages" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>
                    <span className="secondary" style={{ fontSize: '0.85rem' }}>
                      Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={currentPage >= pagination.totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
};
