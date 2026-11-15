import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Package, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { formatPrice } from '../../utils/format';
import type { AdminListingRow, Category, Pagination as PaginationT, ServiceArea } from '../types';
import { Button, Card, EmptyState, ErrorBanner, ListingStatusPill, LISTING_STATUS, Loading, PageHeader, Pagination, Thumb, VerifiedBadge, apiError, fmtDate, fmtNum, qs } from '../ui';
import { ParamSelect, SearchBox, usePageParam } from '../filters';

const PAGE_SIZE = 25;
const STATUS_OPTIONS: [string, string][] = ['PENDING_REVIEW', 'SUBMITTED', 'LIVE', 'RESERVED', 'CHANGES_REQUESTED', 'SOLD', 'REJECTED', 'SUSPENDED', 'EXPIRED', 'DRAFT'].map((s) => [s, LISTING_STATUS[s]?.[0] ?? s]);

/** Cities and categories for the filter dropdowns (loaded once per page visit). */
function useFilterOptions() {
  const [cities, setCities] = useState<[string, string][]>([]);
  const [categories, setCategories] = useState<[string, string][]>([]);
  useEffect(() => {
    fetchApi<ServiceArea[]>('/locations/service-areas').then((res) => {
      if (res.success && res.data) setCities(res.data.map((a) => [a.cityCode, a.cityName] as [string, string]).sort((a, b) => a[1].localeCompare(b[1])));
    });
    fetchApi<Category[]>('/categories').then((res) => {
      if (!res.success || !res.data) return;
      const opts: [string, string][] = [];
      res.data.forEach((c) => {
        opts.push([c.id, c.name]);
        c.children?.forEach((ch) => opts.push([ch.id, `   ${ch.name}`]));
      });
      setCategories(opts);
    });
  }, []);
  return { cities, categories };
}

export const ListingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = usePageParam();
  const { cities, categories } = useFilterOptions();
  const [listings, setListings] = useState<AdminListingRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const f = {
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    verified: params.get('verified') ?? '',
    cityCode: params.get('cityCode') ?? '',
    categoryId: params.get('categoryId') ?? '',
    sellerId: params.get('sellerId') ?? '',
    sort: params.get('sort') ?? 'newest',
  };
  const query = qs({ ...f, page, limit: PAGE_SIZE });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ listings: AdminListingRow[]; pagination: PaginationT }>(`/admin/listings${query}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) {
        setListings(res.data.listings);
        setPagination(res.data.pagination);
      } else setError(apiError(res, 'Could not load listings'));
    });
    return () => { cancelled = true; };
  }, [query]);

  const hasFilters = !!(f.search || f.status || f.verified || f.cityCode || f.categoryId || f.sellerId);
  const sellerFilterName = f.sellerId && listings?.[0]?.seller.id === f.sellerId ? listings[0].seller.displayName : null;

  return (
    <div>
      <PageHeader
        overline="Catalogue"
        title="Listings inventory"
        titleExtra={pagination && <span className="a-chip a-chip--pill" style={{ marginTop: 8, background: 'var(--a-surface-3)' }}>{fmtNum(pagination.total)}{hasFilters ? ' match' : ' total'}</span>}
        subtitle="Every listing in every status. Open one to review, verify, request changes or suspend it."
      />
      <div className="a-stack">
        <Card>
          <div className="a-toolbar">
            <SearchBox label="Search listings" placeholder="Title, seller name or user code" />
            <ParamSelect name="status" label="Status" allLabel="All statuses" options={STATUS_OPTIONS} />
            <ParamSelect name="verified" label="Verified" allLabel="Verified: any" options={[['true', 'Verified'], ['false', 'Not verified']]} />
            <ParamSelect name="cityCode" label="City" allLabel="All cities" options={cities} />
            <ParamSelect name="categoryId" label="Category" allLabel="All categories" options={categories} />
            <ParamSelect name="sort" label="Sort" defaultValue="newest" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['price_desc', 'Price: high to low'], ['price_asc', 'Price: low to high']]} />
            {hasFilters && (
              <Button variant="ghost" small icon={<X size={14} />} onClick={() => setParams(f.sort !== 'newest' ? { sort: f.sort } : {})}>
                Clear filters
              </Button>
            )}
          </div>
          {f.sellerId && (
            <div className="a-chip a-chip--accent a-chip--pill" style={{ marginTop: 12, padding: '4px 6px 4px 12px' }}>
              Seller: <Link className="a-link" to={`/users/${f.sellerId}`}>{sellerFilterName ?? 'this user'}</Link>
              <button aria-label="Remove seller filter" style={{ display: 'flex', color: 'inherit' }} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('sellerId'); n.delete('page'); return n; })}>
                <X size={14} />
              </button>
            </div>
          )}
        </Card>
        {error && <ErrorBanner message={error} />}
        <Card flush>
          {!listings && loading ? (
            <Loading />
          ) : listings && listings.length === 0 ? (
            <EmptyState icon={<Package size={30} />} title="No listings found">{hasFilters ? 'Try a different search or clear the filters.' : 'No listings yet.'}</EmptyState>
          ) : (
            <div className="a-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="a-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="a-th-num">Price</th>
                    <th>Status</th>
                    <th>Seller</th>
                    <th className="a-hide-md">City</th>
                    <th className="a-th-num a-hide-md">Offers</th>
                    <th className="a-hide-md">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {listings?.map((l) => (
                    <tr key={l.id} className={`a-tr-link${l.sanitization?.status === 'FLAGGED' ? ' is-flagged' : ''}`} tabIndex={0} onClick={() => navigate(`/listings/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/listings/${l.id}`)}>
                      <td style={{ minWidth: 260, maxWidth: 380 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <Thumb url={l.media[0]?.url} mediaType={l.media[0]?.mediaType} size={48} />
                          <div style={{ minWidth: 0 }}>
                            <div className="a-clamp-2" style={{ fontWeight: 600, lineHeight: 1.35 }} title={l.title}>{l.title}</div>
                            <div className="a-row" style={{ gap: 6, marginTop: 3 }}>
                              <span className="a-small a-text-2">{l.category?.name ?? 'Uncategorised'}<span className="a-show-md"> · {l.cityCode} · {fmtDate(l.createdAt)}</span></span>
                              {l.verifiedAt && <VerifiedBadge small />}
                              {l.sanitization?.status === 'FLAGGED' && <span className="a-chip a-chip--danger"><AlertTriangle size={11} /> Flagged</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="a-td-num" style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{formatPrice(l.price)}</td>
                      <td><ListingStatusPill status={l.status} /></td>
                      <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <Link className="a-link" style={{ fontWeight: 600 }} to={`/users/${l.seller.id}`}>{l.seller.displayName}</Link>
                        <div className="a-small a-text-2">
                          <span className="a-mono">{l.seller.userCode}</span>
                          {l.seller.status !== 'ACTIVE' && <span style={{ color: 'var(--a-danger-text)', fontWeight: 600 }}> · {l.seller.status.toLowerCase()}</span>}
                        </div>
                      </td>
                      <td className="a-text-2 a-hide-md">{l.cityCode}</td>
                      <td className="a-td-num a-hide-md">{fmtNum(l._count.offers)}</td>
                      <td className="a-text-2 a-hide-md" style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination pagination={pagination} onPage={setPage} noun="listings" />
        </Card>
      </div>
    </div>
  );
};
