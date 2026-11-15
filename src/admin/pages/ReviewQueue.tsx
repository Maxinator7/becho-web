import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCheck, CheckCircle2, Clock, Search, ShieldCheck, Timer, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { formatPrice } from '../../utils/format';
import type { AdminUserDetail, Analytics, Sanitization } from '../types';
import {
  Button, Card, EmptyState, ErrorBanner, Loading, Modal, PageHeader, ReasonDialog, Thumb,
  ageShort, apiError, fmtDateTime, fmtMonthYear, fmtNum, humanize, notifyQueueChanged, useToast,
} from '../ui';
import { checkLabel, parseCheck, reasonLabel, scoreTone } from '../sanitization';

interface QueueItem {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  condition?: string;
  submittedAt: string | null;
  createdAt: string;
  cityCode: string;
  seller?: { id: string; displayName: string; email: string | null; phone: string | null };
  category?: { name: string };
  sanitization?: Sanitization | null;
  media?: { url: string; mediaType: string }[];
}

/** Seller facts the queue endpoint doesn't include, fetched once per seller. */
type SellerInfo = Pick<AdminUserDetail['user'], 'userCode' | 'createdAt' | 'emailVerifiedAt' | 'phoneVerifiedAt' | 'status'> & {
  listings: number;
  sold: number;
};

type Tab = 'all' | 'flagged' | 'passed' | 'waiting';
const DAY_MS = 86_400_000;
const submitted = (i: QueueItem) => i.submittedAt ?? i.createdAt;
const waitMs = (i: QueueItem) => Date.now() - new Date(submitted(i)).getTime();

export const ReviewQueuePage: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [sellers, setSellers] = useState<Record<string, SellerInfo>>({});
  const [perf, setPerf] = useState<Analytics['moderation'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<'oldest' | 'newest' | 'price_desc' | 'price_asc'>('oldest');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchApi<QueueItem[]>('/admin/moderation/queue');
    if (res.success && res.data) {
      setItems(res.data);
      setSelected((sel) => new Set([...sel].filter((id) => res.data!.some((i) => i.id === id))));
    } else setError(apiError(res, 'Could not load the review queue'));
    notifyQueueChanged();
  }, []);

  useEffect(() => {
    load();
    fetchApi<Analytics>('/admin/analytics?days=7').then((res) => res.success && res.data && setPerf(res.data.moderation));
  }, [load]);

  // Enrich sellers (user code, member since, verification) — one request per seller not yet loaded.
  useEffect(() => {
    if (!items) return;
    const ids = [...new Set(items.map((i) => i.seller?.id).filter((x): x is string => !!x))].filter((id) => !sellers[id]);
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((id) => fetchApi<AdminUserDetail>(`/admin/users/${id}`))).then((results) => {
      if (cancelled) return;
      const next: Record<string, SellerInfo> = {};
      results.forEach((r, i) => {
        if (!r.success || !r.data) return;
        const { user, stats } = r.data;
        next[ids[i]] = {
          userCode: user.userCode, createdAt: user.createdAt, emailVerifiedAt: user.emailVerifiedAt, phoneVerifiedAt: user.phoneVerifiedAt, status: user.status,
          listings: Object.values(stats.listingsByStatus).reduce((a, b) => a + b, 0),
          sold: stats.listingsByStatus.SOLD ?? 0,
        };
      });
      setSellers((s) => ({ ...s, ...next }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const all = items ?? [];
  const counts = {
    all: all.length,
    flagged: all.filter((i) => i.sanitization?.status === 'FLAGGED').length,
    passed: all.filter((i) => i.sanitization?.status === 'PASSED').length,
    waiting: all.filter((i) => waitMs(i) > DAY_MS).length,
  };
  const cities = [...new Set(all.map((i) => i.cityCode))].sort();
  const categories = [...new Set(all.map((i) => i.category?.name).filter((x): x is string => !!x))].sort();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = all.filter((i) => {
      if (tab === 'flagged' && i.sanitization?.status !== 'FLAGGED') return false;
      if (tab === 'passed' && i.sanitization?.status !== 'PASSED') return false;
      if (tab === 'waiting' && waitMs(i) <= DAY_MS) return false;
      if (city && i.cityCode !== city) return false;
      if (category && i.category?.name !== category) return false;
      if (q) {
        const code = i.seller ? sellers[i.seller.id]?.userCode ?? '' : '';
        const hay = `${i.title} ${i.seller?.displayName ?? ''} ${code} ${i.cityCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      oldest: (a: QueueItem, b: QueueItem) => submitted(a).localeCompare(submitted(b)),
      newest: (a: QueueItem, b: QueueItem) => submitted(b).localeCompare(submitted(a)),
      price_desc: (a: QueueItem, b: QueueItem) => b.price - a.price,
      price_asc: (a: QueueItem, b: QueueItem) => a.price - b.price,
    }[sort];
    return out.sort(by);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tab, search, city, category, sort, sellers]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, pages);
  const rows = filtered.slice((curPage - 1) * perPage, curPage * perPage);
  const hasFilters = !!(search || city || category);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  useEffect(() => setPage(1), [tab, search, city, category, sort, perPage]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((s) => {
    const n = new Set(s);
    if (allOnPageSelected) rows.forEach((r) => n.delete(r.id));
    else rows.forEach((r) => n.add(r.id));
    return n;
  });

  const approve = async (item: QueueItem) => {
    setBusy(item.id);
    const res = await fetchApi(`/admin/moderation/listings/${item.id}/approve`, { method: 'POST', body: '{}' });
    setBusy(null);
    if (res.success) toast('success', `Approved “${item.title}” — it is now live.`);
    else toast('danger', apiError(res, 'Could not approve'));
    load();
  };

  const selectedItems = all.filter((i) => selected.has(i.id));

  return (
    <div>
      <PageHeader
        overline="Moderation"
        meta="oldest first"
        title="Listings review queue"
        titleExtra={items && <span className="a-chip a-chip--pill" style={{ marginTop: 8, background: 'var(--a-surface-3)' }}>{fmtNum(counts.all)} pending</span>}
        actions={
          perf && (
            <div className="a-card" style={{ padding: '12px 16px', display: 'flex', gap: 20, alignItems: 'center' }}>
              <div>
                <div className="a-section-label">Last 7 days</div>
                <div style={{ fontWeight: 700 }}>{fmtNum(perf.reviewedInPeriod)} approved</div>
              </div>
              <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--a-border)' }} />
              <div>
                <div className="a-section-label">Avg time to approve</div>
                <div style={{ fontWeight: 700, color: 'var(--a-primary-text)' }}>{perf.avgHoursToApprove == null ? '—' : `${perf.avgHoursToApprove} h`}</div>
              </div>
            </div>
          )
        }
      />
      {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!items && !error && <Loading />}

      {items && (
        <div className="a-stack">
          <Card>
            <div className="a-tabs" role="tablist" aria-label="Queue filter">
              {([
                ['all', 'All pending', counts.all],
                ['flagged', 'Flagged by checks', counts.flagged],
                ['passed', 'Passed checks', counts.passed],
                ['waiting', 'Waiting over 24 h', counts.waiting],
              ] as [Tab, string, number][]).map(([k, label, n]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={tab === k}
                  className={`a-tab${k === 'flagged' && n > 0 && tab !== k ? ' a-tab--danger' : ''}`}
                  onClick={() => setTab(k)}
                >
                  {k === 'flagged' && <AlertTriangle size={14} />}
                  {label} <span className="a-tab__count">{n}</span>
                </button>
              ))}
            </div>
            <hr className="a-divider" />
            <div className="a-toolbar" style={{ justifyContent: 'space-between' }}>
              <div className="a-toolbar">
                <div className="a-input-wrap" style={{ width: 260 }}>
                  <Search size={15} />
                  <input className="a-input a-input--soft" type="search" aria-label="Filter the queue" placeholder="Title, seller or user code" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <select className="a-select a-select--soft" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">All cities</option>
                  {cities.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="a-select a-select--soft" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="a-select a-select--soft" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="oldest">Oldest first</option>
                  <option value="newest">Newest first</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="price_asc">Price: low to high</option>
                </select>
                {hasFilters && (
                  <Button variant="ghost" small icon={<X size={14} />} onClick={() => { setSearch(''); setCity(''); setCategory(''); }}>Reset filters</Button>
                )}
              </div>
              <div className="a-toolbar">
                <span className="a-small a-text-2" style={{ fontWeight: 600 }}>{selected.size} selected</span>
                {selected.size > 0 && <Button variant="ghost" small onClick={() => setSelected(new Set())}>Clear</Button>}
                <Button variant="soft" icon={<CheckCheck size={15} />} disabled={selected.size === 0} onClick={() => setBulkOpen(true)}>
                  Approve selected ({selected.size})
                </Button>
              </div>
            </div>
          </Card>

          <Card flush>
            {all.length === 0 ? (
              <EmptyState icon={<ShieldCheck size={32} />} title="Queue is clear">No flagged or pending listings right now.</EmptyState>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<Search size={28} />} title="Nothing matches">Try another tab or reset the filters.</EmptyState>
            ) : (
              <div className="a-table-wrap">
                <table className="a-table a-table--top a-table--dense">
                  <thead>
                    <tr>
                      <th style={{ width: 44 }}>
                        <input type="checkbox" className="a-checkbox" aria-label="Select all on this page" checked={allOnPageSelected} onChange={togglePage} />
                      </th>
                      <th>Item preview &amp; listing</th>
                      <th>Seller</th>
                      <th>Asking price</th>
                      <th>Auto-check signals</th>
                      <th className="a-hide-md">Waiting</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => {
                      const sz = item.sanitization;
                      const flagged = sz?.status === 'FLAGGED';
                      const reasons = sz?.reasons ?? [];
                      const passedChecks = sz?.checks ? Object.entries(sz.checks).map(([k, v]) => [k, parseCheck(v)] as const).filter(([, c]) => c.passed) : [];
                      const info = item.seller ? sellers[item.seller.id] : undefined;
                      const wait = waitMs(item);
                      const photos = item.media?.filter((m) => m.mediaType === 'IMAGE').length ?? 0;
                      const videos = item.media?.filter((m) => m.mediaType === 'VIDEO').length ?? 0;
                      const first = item.media?.find((m) => m.mediaType === 'IMAGE') ?? item.media?.[0];
                      return (
                        <tr key={item.id} className={`${flagged ? 'is-flagged' : ''} ${selected.has(item.id) ? 'is-selected' : ''}`}>
                          <td>
                            <input type="checkbox" className="a-checkbox" style={{ marginTop: 4 }} aria-label={`Select ${item.title}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                          </td>
                          <td style={{ minWidth: 230 }}>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <Link to={`/listings/${item.id}`} tabIndex={-1} aria-hidden>
                                <Thumb url={first?.url} mediaType={first?.mediaType} size={64} tag={photos + videos > 0 ? `${photos + videos} media` : undefined} />
                              </Link>
                              <div style={{ minWidth: 0 }}>
                                <Link to={`/listings/${item.id}`} className="a-clamp-2" style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>{item.title}</Link>
                                <div className="a-small a-text-2" style={{ marginTop: 2 }}>
                                  {item.category?.name ?? 'Uncategorised'}{item.condition ? ` · ${humanize(item.condition)}` : ''}
                                </div>
                                <div className="a-row" style={{ gap: 6, marginTop: 6 }}>
                                  {info && <span className="a-chip a-chip--mono">{info.userCode}</span>}
                                  <span className="a-small a-text-2">{item.cityCode}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ minWidth: 150 }}>
                            {item.seller ? (
                              <>
                                <Link to={`/users/${item.seller.id}`} className="a-row" style={{ gap: 4, fontWeight: 700 }}>
                                  {item.seller.displayName}
                                  {info?.emailVerifiedAt && info?.phoneVerifiedAt && <CheckCircle2 size={14} color="var(--a-success)" aria-label="Email and mobile verified" />}
                                </Link>
                                <div className="a-small a-text-2">{info ? `Member since ${fmtMonthYear(info.createdAt)}` : '…'}</div>
                                {info && (
                                  <div className="a-row" style={{ gap: 6, marginTop: 6 }}>
                                    <span className={`a-chip ${info.emailVerifiedAt ? 'a-chip--success' : 'a-chip--warning'}`}>Email {info.emailVerifiedAt ? '✓' : '✗'}</span>
                                    <span className={`a-chip ${info.phoneVerifiedAt ? 'a-chip--success' : 'a-chip--warning'}`}>Mobile {info.phoneVerifiedAt ? '✓' : '✗'}</span>
                                  </div>
                                )}
                                {info && (
                                  <div className="a-small a-muted" style={{ marginTop: 4 }}>
                                    {info.listings} listing{info.listings === 1 ? '' : 's'} · {info.sold} sold
                                    {info.status !== 'ACTIVE' && <span style={{ color: 'var(--a-danger-text)', fontWeight: 600 }}> · {humanize(info.status)}</span>}
                                  </div>
                                )}
                              </>
                            ) : '—'}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: flagged && reasons.includes('SUSPICIOUS_PRICING') ? 'var(--a-danger-text)' : undefined }}>{formatPrice(item.price)}</div>
                            <div className="a-small a-text-2">{humanize(item.status)}</div>
                            <div className="a-show-md a-small" style={{ marginTop: 4, fontWeight: 600, color: wait > DAY_MS ? 'var(--a-warning-text)' : 'var(--a-text-2)' }}>
                              Waiting {ageShort(submitted(item))}
                            </div>
                          </td>
                          <td style={{ minWidth: 170 }}>
                            {!sz ? (
                              <span className="a-chip">Not checked yet</span>
                            ) : (
                              <div className="a-stack" style={{ gap: 6, alignItems: 'flex-start' }}>
                                {flagged ? (
                                  <span className="a-chip a-chip--solid-danger"><AlertTriangle size={12} /> Flagged · score {Math.round(sz.score * 100)}%</span>
                                ) : (
                                  <span className={`a-chip a-chip--${scoreTone(sz.score)}`}><ShieldCheck size={12} /> {humanize(sz.status)} · score {Math.round(sz.score * 100)}%</span>
                                )}
                                {reasons.map((r) => <span key={r} className="a-chip a-chip--danger"><AlertTriangle size={12} /> {reasonLabel(r)}</span>)}
                                {passedChecks.length > 0 && (
                                  <span className="a-chip a-chip--success" title={passedChecks.map(([k]) => checkLabel(k)).join(', ')}>
                                    <CheckCircle2 size={12} /> {flagged ? `${passedChecks.length} other check${passedChecks.length === 1 ? '' : 's'} passed` : `All ${passedChecks.length} checks passed`}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="a-hide-md" style={{ whiteSpace: 'nowrap' }} title={`Submitted ${fmtDateTime(submitted(item))}`}>
                            <div className="a-row" style={{ gap: 4, fontWeight: 700, color: wait > DAY_MS ? 'var(--a-warning-text)' : undefined }}>
                              {wait > DAY_MS ? <Timer size={14} /> : <Clock size={14} />} {ageShort(submitted(item))}
                            </div>
                            <div className="a-small a-text-2">since submitted</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                              <Button variant="ink" small loading={busy === item.id} onClick={() => approve(item)}>Approve</Button>
                              <Button variant="danger" small disabled={busy === item.id} onClick={() => setRejecting(item)}>Reject</Button>
                              <Link to={`/listings/${item.id}`} className="a-link a-small" style={{ textAlign: 'center' }}>Inspect</Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="a-table-foot">
                <div className="a-row" style={{ gap: 16 }}>
                  <span>Showing <strong style={{ color: 'var(--a-text)' }}>{(curPage - 1) * perPage + 1}–{Math.min(curPage * perPage, filtered.length)}</strong> of {filtered.length} pending listings</span>
                  <label className="a-row" style={{ gap: 6 }}>
                    Rows per page
                    <select className="a-select" style={{ height: 30 }} value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                      {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                </div>
                {pages > 1 && (
                  <nav className="a-pager" aria-label="Pagination">
                    <button disabled={curPage <= 1} onClick={() => setPage(curPage - 1)} aria-label="Previous page">‹</button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((p) =>
                      p === curPage ? <span key={p} className="a-pager__cur" aria-current="page">{p}</span> : <button key={p} onClick={() => setPage(p)} aria-label={`Page ${p}`}>{p}</button>,
                    )}
                    <button disabled={curPage >= pages} onClick={() => setPage(curPage + 1)} aria-label="Next page">›</button>
                  </nav>
                )}
              </div>
            )}
          </Card>

          <div className="a-grid-2">
            {perf && <PerformanceCard perf={perf} />}
            <AutoCheckCard items={all} counts={counts} />
          </div>
        </div>
      )}

      {rejecting && (
        <ReasonDialog
          title="Reject listing"
          description={<>“{rejecting.title}” will be rejected and the seller notified with your reason.</>}
          label="Reason shown to the seller"
          placeholder="e.g. Prohibited item / misleading photos"
          confirmLabel="Reject listing"
          variant="danger-solid"
          minLength={0}
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            const res = await fetchApi(`/admin/moderation/listings/${rejecting.id}/reject`, { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) });
            if (!res.success) return apiError(res, 'Could not reject');
            toast('success', `Rejected “${rejecting.title}”.`);
            setRejecting(null);
            load();
            return null;
          }}
        />
      )}
      {bulkOpen && (
        <BulkApproveDialog
          items={selectedItems}
          onClose={() => setBulkOpen(false)}
          onDone={(ok, failed) => {
            setBulkOpen(false);
            setSelected(new Set(failed.map((f) => f.id)));
            if (ok > 0) toast('success', `Approved ${ok} listing${ok === 1 ? '' : 's'} — now live.`);
            if (failed.length) toast('danger', `${failed.length} could not be approved: ${failed.map((f) => `“${f.title}” (${f.error})`).join('; ')}`);
            load();
          }}
        />
      )}
    </div>
  );
};

/** Confirms, then approves each selected listing one by one with the existing approve endpoint. */
const BulkApproveDialog: React.FC<{
  items: QueueItem[];
  onClose: () => void;
  onDone: (ok: number, failed: { id: string; title: string; error: string }[]) => void;
}> = ({ items, onClose, onDone }) => {
  const [progress, setProgress] = useState<number | null>(null);
  const flagged = items.filter((i) => i.sanitization?.status === 'FLAGGED').length;
  const run = async () => {
    let ok = 0;
    const failed: { id: string; title: string; error: string }[] = [];
    for (let i = 0; i < items.length; i++) {
      setProgress(i);
      const res = await fetchApi(`/admin/moderation/listings/${items[i].id}/approve`, { method: 'POST', body: '{}' });
      if (res.success) ok++;
      else failed.push({ id: items[i].id, title: items[i].title, error: apiError(res, 'failed') });
    }
    onDone(ok, failed);
  };
  const running = progress !== null;
  return (
    <Modal
      title={`Approve ${items.length} listing${items.length === 1 ? '' : 's'}?`}
      onClose={running ? () => {} : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={running}>Cancel</Button>
          <Button variant="ink" loading={running} onClick={run}>
            {running ? `Approving ${progress! + 1} of ${items.length}…` : `Approve ${items.length}`}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: 13.5, color: 'var(--a-text-2)', marginBottom: 12 }}>Each listing goes live on the marketplace and its seller is notified.</p>
      {flagged > 0 && (
        <div className="a-banner a-banner--warning" style={{ marginBottom: 12 }}>
          <AlertTriangle size={16} /> {flagged} of these {flagged === 1 ? 'was' : 'were'} flagged by automated checks. Make sure you’ve looked at {flagged === 1 ? 'it' : 'them'}.
        </div>
      )}
      <ul className="a-stack" style={{ gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {items.map((i) => (
          <li key={i.id} className="a-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', fontSize: 13 }}>
            <span className="a-ellipsis">{i.title}</span>
            <span className="a-text-2" style={{ whiteSpace: 'nowrap' }}>{formatPrice(i.price)}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
};

const ACTION_LABEL: Record<string, string> = { APPROVED: 'Approved', REJECTED: 'Rejected', CHANGES_REQUESTED: 'Changes requested', SUSPENDED: 'Suspended', VERIFIED: 'Verified', UNVERIFIED: 'Verification removed', REMARK: 'Remarks' };

const PerformanceCard: React.FC<{ perf: Analytics['moderation'] }> = ({ perf }) => {
  const actions = Object.entries(perf.actions).sort((a, b) => b[1] - a[1]);
  const total = actions.reduce((s, [, n]) => s + n, 0);
  return (
    <Card>
      <div className="a-row" style={{ justifyContent: 'space-between' }}>
        <span className="a-section-label">Review performance</span>
        <span className="a-chip a-chip--success a-chip--pill">Last 7 days</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 4px' }}>{fmtNum(total)} staff decisions</div>
      <p className="a-text-2" style={{ fontSize: 14 }}>
        {actions.length ? actions.map(([k, n]) => `${fmtNum(n)} ${(ACTION_LABEL[k] ?? humanize(k)).toLowerCase()}`).join(', ') : 'No moderation actions yet.'}
      </p>
      <hr className="a-divider" />
      <div className="a-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div className="a-small a-text-2">Avg time to approve</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--a-primary-text)' }}>{perf.avgHoursToApprove == null ? '—' : `${perf.avgHoursToApprove} h`}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="a-small a-text-2">Approved (submitted → live)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--a-success-text)' }}>{fmtNum(perf.reviewedInPeriod)}</div>
        </div>
      </div>
    </Card>
  );
};

const AutoCheckCard: React.FC<{ items: QueueItem[]; counts: { all: number; flagged: number; passed: number } }> = ({ items, counts }) => {
  const scored = items.filter((i) => i.sanitization);
  const avg = scored.length ? scored.reduce((s, i) => s + (i.sanitization!.score ?? 0), 0) / scored.length : null;
  const reasonCounts: Record<string, number> = {};
  items.forEach((i) => (i.sanitization?.reasons ?? []).forEach((r) => { reasonCounts[r] = (reasonCounts[r] ?? 0) + 1; }));
  const top = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]);
  return (
    <Card>
      <div className="a-row" style={{ justifyContent: 'space-between' }}>
        <span className="a-section-label">Automated checks</span>
        <span className="a-chip a-chip--accent a-chip--pill">Current queue</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, margin: '10px 0 12px' }}>Auto-check summary</div>
      <div className="a-row" style={{ gap: 10, flexWrap: 'nowrap', marginBottom: 14 }}>
        <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Flagged</div><div className="a-mini__value" style={{ color: counts.flagged ? 'var(--a-danger-text)' : undefined }}>{counts.flagged}</div></div>
        <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Passed</div><div className="a-mini__value" style={{ color: 'var(--a-success-text)' }}>{counts.passed}</div></div>
        <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Avg score</div><div className="a-mini__value">{avg == null ? '—' : `${Math.round(avg * 100)}%`}</div></div>
      </div>
      {top.length === 0 ? (
        <div className="a-small a-text-2">No red flags in the current queue.</div>
      ) : (
        <ul className="a-stack" style={{ gap: 8 }}>
          {top.map(([r, n]) => (
            <li key={r} className="a-row" style={{ justifyContent: 'space-between', fontSize: 13.5 }}>
              <span className="a-row" style={{ gap: 6 }}><AlertTriangle size={14} color="var(--a-danger-text)" /> {reasonLabel(r)}</span>
              <strong>{n}</strong>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};
