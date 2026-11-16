import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, ClipboardList, Mail, MapPin, Package, RotateCcw, ShieldCheck, ShieldOff, Smartphone, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { formatPrice } from '../../utils/format';
import type { AdminListingRow, AdminUserDetail, Analytics, Category, Pagination as PaginationT, ServiceArea } from '../types';
import {
  Button, Card, EmptyState, ErrorBanner, ListingStatusPill, LISTING_STATUS, Loading, PageHeader, Pagination, Thumb,
  apiError, fmtNum, notifyQueueChanged, qs, useToast,
} from '../ui';
import { ParamSelect, SearchBox, usePageParam } from '../filters';

const PAGE_SIZE = 25;
const REVIEWABLE = ['PENDING_REVIEW', 'SUBMITTED'];
/** Status tabs, in order. Tabs after the first five only show when they have listings. */
const TAB_STATUSES = ['LIVE', 'PENDING_REVIEW', 'RESERVED', 'SOLD', 'REJECTED', 'SUSPENDED', 'CHANGES_REQUESTED', 'SUBMITTED', 'EXPIRED', 'DRAFT', 'APPROVED', 'ARCHIVED'];
const ALWAYS_SHOWN = 5;
const TAB_LABEL: Record<string, string> = { LIVE: 'Active / Live', PENDING_REVIEW: 'Pending review', RESERVED: 'Reserved', SOLD: 'Sold' };

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
        c.children?.forEach((ch) => opts.push([ch.id, `   ${ch.name}`]));
      });
      setCategories(opts);
    });
  }, []);
  return { cities, categories };
}

/** Seller email/mobile verification isn't in the listings response, so look each seller up once (cached for the session). */
type SellerVerif = { email: boolean; phone: boolean; hasEmail: boolean; hasPhone: boolean };
const sellerCache = new Map<string, SellerVerif>();
function useSellerVerification(ids: string[]) {
  const [, bump] = useState(0);
  const key = ids.join(',');
  useEffect(() => {
    const missing = [...new Set(ids)].filter((id) => !sellerCache.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map((id) => fetchApi<AdminUserDetail>(`/admin/users/${id}`))).then((results) => {
      results.forEach((r, i) => {
        if (!r.success || !r.data) return;
        const u = r.data.user;
        sellerCache.set(missing[i], { email: !!u.emailVerifiedAt, phone: !!u.phoneVerifiedAt, hasEmail: !!u.email, hasPhone: !!u.phone });
      });
      if (!cancelled) bump((n) => n + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (id: string) => sellerCache.get(id);
}

const VerifChip: React.FC<{ ok: boolean; icon: React.ReactNode; label: string }> = ({ ok, icon, label }) => (
  <span className={`a-vchip${ok ? ' is-ok' : ''}`} title={`${label} ${ok ? 'verified' : 'not verified'}`}>
    {icon} {ok ? `${label} verified` : `${label} unverified`}
  </span>
);

const StatChip: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode; to: string }> = ({ icon, label, value, to }) => (
  <Link to={to} className="a-statchip">
    <span className="a-statchip__icon" aria-hidden>{icon}</span>
    <span>
      <span className="a-statchip__label">{label}</span>
      <span className="a-statchip__value">{value}</span>
    </span>
  </Link>
);

export const ListingsPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = usePageParam();
  const { cities, categories } = useFilterOptions();
  const [listings, setListings] = useState<AdminListingRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [stats, setStats] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

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

  const loadStats = useCallback(() => {
    fetchApi<Analytics>('/admin/analytics?days=7').then((res) => res.success && res.data && setStats(res.data));
  }, []);
  useEffect(loadStats, [loadStats]);

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
  }, [query, reloadKey]);

  const seller = useSellerVerification(listings?.map((l) => l.seller.id) ?? []);
  const cityName = Object.fromEntries(cities);

  const byStatus = stats?.totals.listings.byStatus ?? {};
  const allCount = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const tabs = TAB_STATUSES.filter((s, i) => i < ALWAYS_SHOWN || (byStatus[s] ?? 0) > 0 || f.status === s);
  const narrowed = !!(f.search || f.verified || f.cityCode || f.categoryId || f.sellerId);
  const hasFilters = narrowed || !!f.status;
  const sellerFilterName = f.sellerId && listings?.[0]?.seller.id === f.sellerId ? listings[0].seller.displayName : null;

  const setStatus = (s: string) => setParams((p) => {
    const n = new URLSearchParams(p);
    if (s) n.set('status', s); else n.delete('status');
    n.delete('page');
    return n;
  });

  const approve = async (l: AdminListingRow) => {
    setBusy(l.id);
    const res = await fetchApi(`/admin/moderation/listings/${l.id}/approve`, { method: 'POST', body: '{}' });
    setBusy(null);
    if (res.success) {
      toast('success', `“${l.title}” approved and live.`);
      notifyQueueChanged();
      loadStats();
      setReloadKey((k) => k + 1);
    } else toast('danger', apiError(res, 'Could not approve'));
  };

  return (
    <div>
      <PageHeader
        overline="Catalogue moderation desk"
        title="Listings inventory"
        subtitle="Review, manage and moderate classified ads across every Becho city."
        actions={stats && (
          <div className="a-statchips">
            <StatChip icon={<BadgeCheck size={17} />} label="Becho verified" value={`${fmtNum(stats.totals.listings.verifiedLive)} live`} to="/listings?verified=true&status=LIVE" />
            <StatChip icon={<ClipboardList size={17} />} label="Pending queue" value={`${fmtNum(stats.moderation.queueSize)} ads`} to="/queue" />
          </div>
        )}
      />
      <div className="a-stack">
        <Card>
          <div className="a-toolbar">
            <SearchBox label="Search listings" placeholder="Title, seller name or user code" width={260} />
            <ParamSelect name="categoryId" label="Category" allLabel="All categories" options={categories} />
            <ParamSelect name="cityCode" label="City" allLabel="All cities" options={cities} />
            <ParamSelect name="verified" label="Becho trust" allLabel="Any trust status" options={[['true', 'Becho verified'], ['false', 'Not verified']]} />
            <ParamSelect name="sort" label="Sort" defaultValue="newest" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['price_desc', 'Price: high to low'], ['price_asc', 'Price: low to high']]} />
            <Button icon={<RotateCcw size={14} />} disabled={!hasFilters && f.sort === 'newest'} onClick={() => setParams({})}>Reset</Button>
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

        <div className="a-tabs a-tabs--status" role="tablist" aria-label="Listing status">
          {['', ...tabs].map((s) => {
            const label = s ? TAB_LABEL[s] ?? LISTING_STATUS[s]?.[0] ?? s : 'All listings';
            const n = s ? byStatus[s] ?? 0 : allCount;
            const tone = s ? LISTING_STATUS[s]?.[1] ?? 'neutral' : null;
            return (
              <button key={s || 'all'} role="tab" aria-selected={f.status === s} className="a-tab" onClick={() => setStatus(s)} title={narrowed ? 'Counts are across all cities and categories' : undefined}>
                {tone && <span className={`a-dot a-dot--${tone}`} aria-hidden />}
                {label}
                {stats && <span className="a-tab__count">{fmtNum(n)}</span>}
              </button>
            );
          })}
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setReloadKey((k) => k + 1)} />}
        <Card flush>
          {!listings && loading ? (
            <Loading />
          ) : listings && listings.length === 0 ? (
            <EmptyState icon={<Package size={30} />} title="No listings found">{hasFilters ? 'Try a different search, tab or filter.' : 'No listings yet.'}</EmptyState>
          ) : (
            <div className="a-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
              <table className="a-table a-table--inv">
                <thead>
                  <tr>
                    <th>Listing details</th>
                    <th>Seller & verification</th>
                    <th>Location & price</th>
                    <th>Status</th>
                    <th className="a-hide-md">Becho trust</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {listings?.map((l) => {
                    const v = seller(l.seller.id);
                    const pending = REVIEWABLE.includes(l.status);
                    return (
                      <tr key={l.id} className={`a-tr-link${l.sanitization?.status === 'FLAGGED' ? ' is-flagged' : ''}`} tabIndex={0} onClick={() => navigate(`/listings/${l.id}`)} onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && navigate(`/listings/${l.id}`)}>
                        <td className="a-inv-title">
                          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <Thumb url={l.media[0]?.url} mediaType={l.media[0]?.mediaType} size={48} />
                            <div style={{ minWidth: 0 }}>
                              <div className="a-clamp-2" style={{ fontWeight: 600, fontSize: 14.5, lineHeight: 1.35 }} title={l.title}>{l.title}</div>
                              <div className="a-row" style={{ gap: 6, marginTop: 4 }}>
                                <span className="a-small a-mono a-text-2">#{l.id.slice(0, 8).toUpperCase()}</span>
                                <span className="a-chip a-chip--accent a-chip--cat">{l.category?.name ?? 'Uncategorised'}</span>
                                {l.verifiedAt && <span className="a-show-md"><span className="a-trust is-ok"><ShieldCheck size={12} /> Verified</span></span>}
                                {l.sanitization?.status === 'FLAGGED' && <span className="a-chip a-chip--danger"><AlertTriangle size={11} /> Flagged</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ minWidth: 150 }} onClick={(e) => e.stopPropagation()}>
                          <Link className="a-link" style={{ fontWeight: 600 }} to={`/users/${l.seller.id}`}>{l.seller.displayName}</Link>
                          <div className="a-small a-text-2">
                            <span className="a-mono">{l.seller.userCode}</span>
                            {l.seller.status !== 'ACTIVE' && <span style={{ color: 'var(--a-danger-text)', fontWeight: 600 }}> · {l.seller.status.toLowerCase().replace(/_/g, ' ')}</span>}
                          </div>
                          {v && (v.hasEmail || v.hasPhone) && (
                            <div className="a-row" style={{ gap: 4, marginTop: 6 }}>
                              {v.hasEmail && <VerifChip ok={v.email} icon={<Mail size={11} />} label="Email" />}
                              {v.hasPhone && <VerifChip ok={v.phone} icon={<Smartphone size={11} />} label="Mobile" />}
                            </div>
                          )}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <div className="a-small a-text-2" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {cityName[l.cityCode] ?? l.cityCode}</div>
                          <div style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatPrice(l.price)}</div>
                        </td>
                        <td><ListingStatusPill status={l.status} /></td>
                        <td className="a-hide-md">
                          {l.verifiedAt ? (
                            <span className="a-trust is-ok"><ShieldCheck size={14} /> Verified</span>
                          ) : (
                            <span className="a-trust"><ShieldOff size={14} /> Not verified</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          {pending ? (
                            <Button variant="success" small loading={busy === l.id} onClick={() => approve(l)}>Approve</Button>
                          ) : (
                            <Button small onClick={() => navigate(`/listings/${l.id}`)}>Inspect</Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
