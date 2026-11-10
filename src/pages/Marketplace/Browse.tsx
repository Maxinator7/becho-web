import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useLocation } from '../../context/LocationContext';
import { formatPrice, CONDITION_LABELS } from '../../utils/format';
import { Navbar } from '../../components/Navbar';
import { Search, SlidersHorizontal, ChevronRight, MapPin, ArrowUpDown, ChevronLeft } from 'lucide-react';

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
}

interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const Browse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedArea, areas } = useLocation();
  const cityName = (code: string) => areas.find((a) => a.cityCode === code)?.cityName ?? code;

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
  }, [selectedCategoryId, searchQuery, minPrice, maxPrice, condition, sortOrder, currentPage, selectedArea]);

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
    setCurrentPage(1);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />

      {/* Page Title & Search Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>Discover & Search Listings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Showing {pagination.total} item{pagination.total !== 1 ? 's' : ''} available near you
          </p>
        </div>

        {/* Top Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '450px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by title, keyword, brand..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.4rem',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#fff',
                outline: 'none',
                fontSize: '0.9rem',
              }}
            />
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem' }}>
            Search
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem' }}>
        {/* Left Sidebar Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <SlidersHorizontal size={18} color="var(--accent-primary)" /> Filters
              </h3>
              <button onClick={handleClearFilters} style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', fontSize: '0.8rem', cursor: 'pointer' }}>
                Reset
              </button>
            </div>

            {/* Category Filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Category
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  setSelectedCategoryId(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <option value="" style={{ background: '#0f172a' }}>All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} style={{ background: '#0f172a' }}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Range Filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Price Range (₹)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.85rem',
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.6rem',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff',
                    outline: 'none',
                    fontSize: '0.85rem',
                  }}
                />
              </div>
            </div>

            {/* Condition Filter */}
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
                Item Condition
              </label>
              <select
                value={condition}
                onChange={(e) => {
                  setCondition(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <option value="" style={{ background: '#0f172a' }}>Any Condition</option>
                <option value="NEW" style={{ background: '#0f172a' }}>Brand New</option>
                <option value="LIKE_NEW" style={{ background: '#0f172a' }}>Like New</option>
                <option value="USED" style={{ background: '#0f172a' }}>Used</option>
                <option value="REFURBISHED" style={{ background: '#0f172a' }}>Refurbished</option>
                <option value="FOR_PARTS" style={{ background: '#0f172a' }}>For Parts</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div>
          {/* Controls Bar: Sort Selector & View Options */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowUpDown size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sort by:</span>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  outline: 'none',
                  fontSize: '0.85rem',
                }}
              >
                <option value="newest" style={{ background: '#0f172a' }}>Newest Listed</option>
                <option value="price_asc" style={{ background: '#0f172a' }}>Price: Low to High</option>
                <option value="price_desc" style={{ background: '#0f172a' }}>Price: High to Low</option>
              </select>
            </div>
          </div>

          {/* Listings Grid */}
          {loading ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading marketplace listings...</div>
          ) : listings.length === 0 ? (
            <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>No Listings Found</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Try adjusting your search keywords, category selection, or price filters.
              </p>
              <button onClick={handleClearFilters} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>
                Clear All Filters
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
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
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      <div style={{ position: 'relative', height: '170px' }}>
                        <img src={thumb} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <span
                          style={{
                            position: 'absolute',
                            top: '10px',
                            left: '10px',
                            background: 'rgba(0,0,0,0.65)',
                            color: 'var(--accent-primary)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '12px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backdropFilter: 'blur(4px)',
                          }}
                        >
                          {item.category?.name || 'General'}
                        </span>
                      </div>

                      <div style={{ padding: '1.15rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem', lineHeight: '1.35', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </h3>

                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.75rem' }}>
                          {formatPrice(item.price)}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <MapPin size={12} color="var(--accent-secondary)" /> {cityName(item.cityCode)}
                          </span>
                          <span>{CONDITION_LABELS[item.condition] ?? item.condition}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
                  <button
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage <= 1 ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                  </span>

                  <button
                    disabled={currentPage >= pagination.totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      cursor: currentPage >= pagination.totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage >= pagination.totalPages ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
