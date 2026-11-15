import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Package, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { formatPrice } from '../../utils/format';
import type { AdminListingRow, Category, Pagination as PaginationT, ServiceArea } from '../types';
import { Card, EmptyState, ErrorBanner, ListingStatusPill, LISTING_STATUS, Loading, PageHeader, Pagination, Thumb, VerifiedBadge, apiError, fmtDate, fmtNum, qs, toneText } from '../ui';
import { ParamSelect, SearchBox, usePageParam } from './Users';

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
      <PageHeader title="Listings" subtitle={pagination ? `${fmtNum(pagination.total)} listing${pagination.total === 1 ? '' : 's'}${hasFilters ? ' match' : ''}` : 'All listings, every status'} />
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <SearchBox label="Search listings" placeholder="Title, seller name or user code" />
        <ParamSelect name="status" label="Status" allLabel="All statuses" options={STATUS_OPTIONS} />
        <ParamSelect name="verified" label="Verified" allLabel="Verified: any" options={[['true', 'Verified'], ['false', 'Not verified']]} />
        <ParamSelect name="cityCode" label="City" allLabel="All cities" options={cities} />
        <ParamSelect name="categoryId" label="Category" allLabel="All categories" options={categories} />
        <ParamSelect name="sort" label="Sort" defaultValue="newest" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['price_desc', 'Price: high to low'], ['price_asc', 'Price: low to high']]} />
        {hasFilters && (
          <button className="adm-btn adm-link" style={{ fontSize: '0.85rem' }} onClick={() => setParams(f.sort !== 'newest' ? { sort: f.sort } : {})}>
            Clear filters
          </button>
        )}
      </div>
      {f.sellerId && (
        <div style={{ marginBottom: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.25rem 0.4rem 0.25rem 0.7rem', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--border-color)' }}>
          Seller: <Link className="adm-link" to={`/users/${f.sellerId}`}>{sellerFilterName ?? 'this user'}</Link>
          <button className="adm-btn" aria-label="Remove seller filter" style={{ display: 'flex', color: 'var(--text-muted)' }} onClick={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('sellerId'); n.delete('page'); return n; })}>
            <X size={14} />
          </button>
        </div>
      )}
      {error && <div style={{ marginBottom: '1rem' }}><ErrorBanner message={error} /></div>}
      <Card padding="0.5rem 0.75rem 0.85rem">
        {!listings && loading ? (
          <Loading />
        ) : listings && listings.length === 0 ? (
          <EmptyState icon={<Package size={30} />} title="No listings found">{hasFilters ? 'Try a different search or clear the filters.' : 'No listings yet.'}</EmptyState>
        ) : (
          <div className="adm-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th aria-label="Photo" />
                  <th>Title</th>
                  <th className="adm-num">Price</th>
                  <th>Status</th>
                  <th>Seller</th>
                  <th>City</th>
                  <th className="adm-num">Offers</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {listings?.map((l) => (
                  <tr key={l.id} className="adm-row" tabIndex={0} onClick={() => navigate(`/listings/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/listings/${l.id}`)}>
                    <td style={{ width: 56 }}><Thumb url={l.media[0]?.url} mediaType={l.media[0]?.mediaType} size={44} /></td>
                    <td style={{ minWidth: 200, maxWidth: 300 }}>
                      <div style={{ fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.35 }} title={l.title}>{l.title}</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {l.category?.name ?? 'Uncategorised'}
                        {l.verifiedAt && <VerifiedBadge small />}
                        {l.sanitization?.status === 'FLAGGED' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: toneText('danger'), fontWeight: 600 }}><AlertTriangle size={11} /> Flagged</span>
                        )}
                      </div>
                    </td>
                    <td className="adm-num" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatPrice(l.price)}</td>
                    <td><ListingStatusPill status={l.status} /></td>
                    <td style={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      <Link className="adm-link" to={`/users/${l.seller.id}`}>{l.seller.displayName}</Link>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {l.seller.userCode}{l.seller.status !== 'ACTIVE' && <span style={{ color: toneText('danger'), fontFamily: 'inherit' }}> · {l.seller.status.toLowerCase()}</span>}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{l.cityCode}</td>
                    <td className="adm-num">{fmtNum(l._count.offers)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination pagination={pagination} onPage={setPage} noun="listings" />
      </Card>
    </div>
  );
};
