import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Search, SearchX, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useLocation } from '../../context/LocationContext';
import { Navbar } from '../../components/Navbar';
import { CategoryNode, EmptyState, ListingCard, ListingCardData, useCategories, useFavoriteIds } from '../../components/ui';
import { CONDITION_LABELS, formatPrice } from '../../utils/format';

interface PaginationInfo { total: number; page: number; limit: number; totalPages: number }

const PAGE_SIZE = 12;
const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹10k', max: 10000 },
  { label: '₹10k – ₹30k', min: 10000, max: 30000 },
  { label: '₹30k – ₹75k', min: 30000, max: 75000 },
  { label: 'Above ₹75k', min: 75000 },
];
const CONDITIONS = ['NEW', 'LIKE_NEW', 'USED', 'REFURBISHED', 'FOR_PARTS'];
const SORTS: Record<string, string> = { newest: 'Newly listed', price_asc: 'Price: low to high', price_desc: 'Price: high to low' };

/** Page numbers with ellipses: 1 … 4 5 6 … 16 */
function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | '…')[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < total - 1) out.push('…');
  out.push(total);
  return out;
}

export const Browse: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const { selectedArea, areas, setSelectedArea } = useLocation();
  const categories = useCategories();
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const [showFilters, setShowFilters] = useState(params.get('filters') === '1');
  const [catOpen, setCatOpen] = useState(true);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ total: 0, page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // The URL is the source of truth for every filter except the city (shared app-wide via the navbar).
  const categoryId = params.get('categoryId') ?? '';
  const search = params.get('search') ?? '';
  const minPrice = params.get('minPrice') ?? '';
  const maxPrice = params.get('maxPrice') ?? '';
  const condition = params.get('condition') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const verified = params.get('verified') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [minDraft, setMinDraft] = useState(minPrice);
  const [maxDraft, setMaxDraft] = useState(maxPrice);
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setMinDraft(minPrice); setMaxDraft(maxPrice); }, [minPrice, maxPrice]);
  useEffect(() => { setSearchDraft(search); }, [search]);

  /** Update some URL params; anything except a page change goes back to page 1. */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    next.delete('filters');
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k); else next.set(k, v);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  // Links like /browse?city=MUM pick the city, then drop the param.
  const cityParam = params.get('city');
  useEffect(() => {
    if (!cityParam || areas.length === 0) return;
    const area = areas.find((a) => a.cityCode === cityParam.toUpperCase());
    if (area) setSelectedArea(area);
    const next = new URLSearchParams(params);
    next.delete('city');
    setParams(next, { replace: true });
  }, [cityParam, areas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cityParam) return;
    const q = new URLSearchParams();
    if (categoryId) q.set('categoryId', categoryId);
    if (search) q.set('search', search);
    if (minPrice) q.set('minPrice', minPrice);
    if (maxPrice) q.set('maxPrice', maxPrice);
    if (condition) q.set('condition', condition);
    if (verified) q.set('verified', 'true');
    q.set('sort', sort);
    q.set('page', String(page));
    q.set('limit', String(PAGE_SIZE));
    if (selectedArea) { q.set('countryCode', selectedArea.countryCode); q.set('cityCode', selectedArea.cityCode); }
    let live = true;
    setLoading(true);
    fetchApi<{ listings: ListingCardData[]; pagination: PaginationInfo }>(`/listings?${q.toString()}`).then((res) => {
      if (!live) return;
      setLoading(false);
      setFailed(!res.success);
      if (res.success && res.data) {
        setListings(res.data.listings || []);
        if (res.data.pagination) setPagination(res.data.pagination);
      }
    });
    return () => { live = false; };
  }, [categoryId, search, minPrice, maxPrice, condition, sort, verified, page, selectedArea, cityParam]);

  // Category + its parent, for the title, breadcrumb and tree.
  const { cat, parent } = useMemo(() => {
    for (const top of categories) {
      if (top.id === categoryId) return { cat: top as CategoryNode, parent: null as CategoryNode | null };
      const child = top.children?.find((c) => c.id === categoryId);
      if (child) return { cat: child, parent: top };
    }
    return { cat: null, parent: null };
  }, [categories, categoryId]);
  const openTop = parent ?? cat;

  const clearAll = () => {
    setSelectedArea(null);
    setParams(new URLSearchParams());
  };
  const applyPrice = (e?: React.FormEvent) => {
    e?.preventDefault();
    update({ minPrice: minDraft.trim(), maxPrice: maxDraft.trim() });
    setShowFilters(false);
  };

  const applied: { key: string; label: string; clear: () => void }[] = [];
  if (selectedArea) applied.push({ key: 'city', label: selectedArea.cityName, clear: () => setSelectedArea(null) });
  if (cat) applied.push({ key: 'cat', label: cat.name, clear: () => update({ categoryId: null }) });
  if (search) applied.push({ key: 'q', label: `“${search}”`, clear: () => update({ search: null }) });
  if (verified) applied.push({ key: 'v', label: 'Verified by Becho', clear: () => update({ verified: null }) });
  if (minPrice || maxPrice) {
    const lbl = minPrice && maxPrice ? `${formatPrice(+minPrice)} – ${formatPrice(+maxPrice)}` : minPrice ? `From ${formatPrice(+minPrice)}` : `Up to ${formatPrice(+maxPrice)}`;
    applied.push({ key: 'p', label: lbl, clear: () => update({ minPrice: null, maxPrice: null }) });
  }
  if (condition) applied.push({ key: 'c', label: CONDITION_LABELS[condition] ?? condition, clear: () => update({ condition: null }) });

  const title = `${cat ? cat.name : search ? `Results for “${search}”` : 'All listings'} in ${selectedArea ? selectedArea.cityName : 'all cities'}`;
  const first = (pagination.page - 1) * pagination.limit + 1;
  const last = Math.min(pagination.total, pagination.page * pagination.limit);

  return (
    <>
      <Navbar />
      <main className="page browse-v2">
        <nav className="crumbs desktop-only" aria-label="Breadcrumb">
          <Link to="/">Home</Link><ChevronRight size={14} />
          {parent && <><Link to={`/browse?categoryId=${parent.id}`}>{parent.name}</Link><ChevronRight size={14} /></>}
          <span aria-current="page">{cat ? cat.name : 'All listings'}{selectedArea ? ` in ${selectedArea.cityName}` : ''}</span>
        </nav>

        <div className="browse-head">
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title browse-title">
              {title}
              {!loading && <span className="count-chip">{pagination.total} ad{pagination.total === 1 ? '' : 's'} found</span>}
            </h1>
          </div>
          <label className="sort-box">
            <span className="muted">Sort by:</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? null : e.target.value })} aria-label="Sort">
              {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>

        {/* Phone: search + filter toggle */}
        <form role="search" className="mobile-only browse-msearch" onSubmit={(e) => { e.preventDefault(); update({ search: searchDraft.trim() }); }}>
          <label className="searchbar" style={{ flex: 1 }}>
            <Search size={20} />
            <span className="sr-only">Search listings</span>
            <input type="search" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Search phones, bikes, sofas…" />
          </label>
          <button
            type="button"
            className={`icon-btn bordered filter-btn${applied.length ? ' on' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="browse-filters"
            aria-label={applied.length ? `Filters, ${applied.length} active` : 'Filters'}
          >
            <SlidersHorizontal size={20} />
          </button>
        </form>

        <div className="browse-layout v2">
          <aside id="browse-filters" className={`browse-filters${showFilters ? ' open' : ''}`} aria-label="Filters">
            <div className="fbox mobile-only" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="section-title">Filters</h2>
              <button type="button" onClick={() => setShowFilters(false)} className="icon-btn" aria-label="Close filters"><X size={18} /></button>
            </div>

            {applied.length > 0 && (
              <div className="fbox">
                <div className="fbox-head">
                  <span className="f-overline">Applied filters</span>
                  <button type="button" className="link" style={{ fontSize: '0.82rem' }} onClick={clearAll}>Clear all</button>
                </div>
                <div className="applied">
                  {applied.map((f) => (
                    <button key={f.key} type="button" className="applied-chip" onClick={f.clear} aria-label={`Remove filter ${f.label}`}>
                      {f.label} <X size={13} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="fbox">
              <button type="button" className="fbox-toggle" onClick={() => setCatOpen((o) => !o)} aria-expanded={catOpen}>
                <span className="section-title">Categories</span>
                {catOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {catOpen && (
                <ul className="cat-tree">
                  <li>
                    <button type="button" className={`ct-top${!categoryId ? ' on' : ''}`} aria-pressed={!categoryId} onClick={() => update({ categoryId: null })}>All categories</button>
                  </li>
                  {categories.map((top) => {
                    const isOpen = openTop?.id === top.id;
                    return (
                      <li key={top.id}>
                        <button type="button" className={`ct-top${categoryId === top.id ? ' on' : ''}${isOpen ? ' open' : ''}`} aria-pressed={categoryId === top.id} onClick={() => update({ categoryId: top.id })}>
                          {top.name}
                        </button>
                        {isOpen && top.children && top.children.length > 0 && (
                          <ul className="ct-subs">
                            {top.children.map((ch) => (
                              <li key={ch.id}>
                                <button type="button" className={`ct-sub${categoryId === ch.id ? ' on' : ''}`} aria-pressed={categoryId === ch.id} onClick={() => update({ categoryId: ch.id })}>{ch.name}</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="fgroup tinted">
                <span className="f-overline">Seller credibility</span>
                <label className={`check-card${verified ? ' on' : ''}`}>
                  <input type="checkbox" checked={verified} onChange={(e) => update({ verified: e.target.checked ? 'true' : null })} />
                  <span>
                    <span className="cc-t"><BadgeCheck size={15} /> Verified by Becho</span>
                    <span className="cc-s">Listings checked by the Becho team</span>
                  </span>
                </label>
              </div>

              {areas.length > 0 && (
                <div className="fgroup">
                  <span className="f-overline">Cities</span>
                  <div className="region-grid" role="group" aria-label="City">
                    <button type="button" className={`region${!selectedArea ? ' on' : ''}`} aria-pressed={!selectedArea} onClick={() => { setSelectedArea(null); update({}); }}>All cities</button>
                    {areas.map((a) => (
                      <button key={a.id} type="button" className={`region${selectedArea?.id === a.id ? ' on' : ''}`} aria-pressed={selectedArea?.id === a.id} onClick={() => { setSelectedArea(a); update({}); }}>{a.cityName}</button>
                    ))}
                  </div>
                </div>
              )}

              <form className="fgroup" onSubmit={applyPrice}>
                <span className="f-overline" id="price-label">Price budget (₹)</span>
                <div className="price-pair" role="group" aria-labelledby="price-label">
                  <label><span>Min</span><input type="number" inputMode="numeric" min={0} value={minDraft} onChange={(e) => setMinDraft(e.target.value)} placeholder="0" aria-label="Minimum price" /></label>
                  <span className="muted">–</span>
                  <label><span>Max</span><input type="number" inputMode="numeric" min={0} value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} placeholder="Any" aria-label="Maximum price" /></label>
                </div>
                <div className="presets">
                  {PRICE_PRESETS.map((p) => {
                    const on = (minPrice || '') === (p.min?.toString() ?? '') && (maxPrice || '') === (p.max?.toString() ?? '');
                    return (
                      <button key={p.label} type="button" className={`preset${on ? ' on' : ''}`} aria-pressed={on} onClick={() => update({ minPrice: p.min?.toString() ?? null, maxPrice: p.max?.toString() ?? null })}>{p.label}</button>
                    );
                  })}
                </div>
              </form>

              <fieldset className="fgroup">
                <legend className="f-overline">Item condition</legend>
                <div className="radio-list">
                  <label><input type="radio" name="cond" checked={!condition} onChange={() => update({ condition: null })} /> Any condition</label>
                  {CONDITIONS.map((c) => (
                    <label key={c}><input type="radio" name="cond" checked={condition === c} onChange={() => update({ condition: c })} /> {CONDITION_LABELS[c]}</label>
                  ))}
                </div>
              </fieldset>

              <button type="button" className="btn-primary btn-block" onClick={() => applyPrice()} style={{ marginTop: 20 }}><Check size={17} /> Apply filters</button>
              <button type="button" className="btn btn-ghost btn-block btn-sm" onClick={clearAll} style={{ marginTop: 6 }}>Reset all filters</button>
            </div>
          </aside>

          <div className="browse-main">
            <div className="browse-note desktop-only">
              <span className="bn-icon"><ShieldCheck size={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>Direct local exchanges</div>
                <div className="muted" style={{ fontSize: '0.84rem' }}>Meet the seller, check the item in person, and pay only when you are happy.</div>
              </div>
            </div>

            {loading ? (
              <div className="muted" style={{ padding: '48px 0', textAlign: 'center' }} aria-live="polite">Loading listings…</div>
            ) : failed ? (
              <EmptyState icon={<SearchX size={24} />} title="Couldn’t load listings" action={<button type="button" className="btn-primary" onClick={() => update({})}>Try again</button>}>
                Check your connection and try again.
              </EmptyState>
            ) : listings.length === 0 ? (
              <EmptyState icon={<SearchX size={24} />} title="No listings found" action={<button type="button" onClick={clearAll} className="btn-primary">Clear all filters</button>}>
                Try different keywords, another category or city, or a wider price range.
              </EmptyState>
            ) : (
              <>
                <div className="listing-grid">
                  {listings.map((item) => (
                    <ListingCard key={item.id} item={item} favorited={favoriteIds.has(item.id)} onToggleFavorite={toggleFavorite} />
                  ))}
                </div>
                <div className="pager">
                  <span className="secondary" style={{ fontSize: '0.9rem' }}>
                    Showing <strong>{first} – {last}</strong> of <strong>{pagination.total}</strong> listings
                  </span>
                  {pagination.totalPages > 1 && (
                    <nav aria-label="Pages" className="pager-nav">
                      <button type="button" className="pg" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} aria-label="Previous page"><ChevronLeft size={16} /></button>
                      {pageList(page, pagination.totalPages).map((p, i) => p === '…'
                        ? <span key={`e${i}`} className="muted">…</span>
                        : <button key={p} type="button" className={`pg${p === page ? ' on' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => update({ page: String(p) })}>{p}</button>)}
                      <button type="button" className="pg next" disabled={page >= pagination.totalPages} onClick={() => update({ page: String(page + 1) })}>Next <ChevronRight size={16} /></button>
                    </nav>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
};
