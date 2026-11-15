import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { formatPrice, REVIEW_ACTION_LABELS, timeAgo } from '../../utils/format';
import { AlertTriangle, ArrowRight, CheckCircle2, Hourglass, MessageSquareWarning, Pencil, Plus, Tag } from 'lucide-react';
import { EmptyState, StatusChip } from '../../components/ui';

export interface MyListingItem {
  id: string;
  title: string;
  price: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
  category?: { name: string };
  media?: { url: string }[];
  sanitization?: { status: string; reasons: string[] | null } | null;
  verifiedAt?: string | null;
  /** Latest seller-visible staff remark (max 1). */
  reviews?: { action: string; remark: string | null; createdAt: string }[];
}

type Action = 'edit' | 'submit' | 'renew' | 'mark-sold' | 'mark-available' | 'delete';

const ACTIONS_BY_STATUS: Record<string, { action: Action; label: string; confirm?: string }[]> = {
  DRAFT: [{ action: 'submit', label: 'Publish' }, { action: 'edit', label: 'Edit' }, { action: 'delete', label: 'Delete', confirm: 'Delete this draft?' }],
  CHANGES_REQUESTED: [{ action: 'edit', label: 'Edit & resubmit' }, { action: 'delete', label: 'Delete', confirm: 'Delete this listing?' }],
  REJECTED: [{ action: 'edit', label: 'Edit & resubmit' }, { action: 'delete', label: 'Delete', confirm: 'Delete this listing?' }],
  LIVE: [{ action: 'mark-sold', label: 'Mark as sold', confirm: 'Mark this item as sold? Open offers will be closed.' }],
  RESERVED: [
    { action: 'mark-sold', label: 'Mark as sold' },
    { action: 'mark-available', label: 'Deal fell through', confirm: 'Put this listing back on sale?' },
  ],
  EXPIRED: [{ action: 'renew', label: 'Renew' }, { action: 'delete', label: 'Delete', confirm: 'Delete this listing?' }],
  SOLD: [{ action: 'delete', label: 'Remove', confirm: 'Remove this listing from your list?' }],
};

const REASON_LABELS: Record<string, string> = {
  PROHIBITED_CONTENT: 'may contain prohibited items',
  SUSPICIOUS_PRICING: 'price looks unusual',
  MISSING_REQUIRED_INFORMATION: 'description is too short',
};

/** Status tabs: each groups one or more listing statuses. */
const TABS: { id: string; label: string; statuses: string[] | null; countTone?: 'warn' | 'danger' }[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'live', label: 'Live', statuses: ['LIVE', 'RESERVED'] },
  { id: 'review', label: 'Under review', statuses: ['PENDING_REVIEW'], countTone: 'warn' },
  { id: 'changes', label: 'Changes requested', statuses: ['CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED'], countTone: 'danger' },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { id: 'sold', label: 'Sold', statuses: ['SOLD'] },
  { id: 'expired', label: 'Expired', statuses: ['EXPIRED'] },
];

/** The seller's listings with status tabs, staff remarks and actions (part of the account page). */
export const MyListingsPanel: React.FC<{
  listings: MyListingItem[];
  loading: boolean;
  reload: () => void;
  notice?: string;
}> = ({ listings, loading, reload, notice }) => {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('all');

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of TABS) out[t.id] = t.statuses ? listings.filter((l) => t.statuses!.includes(l.status)).length : listings.length;
    return out;
  }, [listings]);
  const visibleTabs = TABS.filter((t) => t.id === 'all' || counts[t.id] > 0);
  const activeTab = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0];
  const shown = activeTab.statuses ? listings.filter((l) => activeTab.statuses!.includes(l.status)) : listings;

  const runAction = async (item: MyListingItem, action: Action, confirmText?: string) => {
    if (action === 'edit') {
      navigate(`/listings/${item.id}/edit`);
      return;
    }
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(item.id);
    setError(null);
    const res = action === 'delete'
      ? await fetchApi(`/listings/${item.id}`, { method: 'DELETE' })
      : await fetchApi(`/listings/${item.id}/${action}`, { method: 'POST' });
    setBusyId(null);
    if (!res.success) setError(res.error?.message || 'Something went wrong');
    reload();
  };

  return (
    <section aria-labelledby="my-listings-title" id="my-listings">
      <div className="section-head" style={{ alignItems: 'center' }}>
        <h2 id="my-listings-title" className="section-title">My listings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="overline">{listings.length} total</span>
          <Link to="/create-listing" className="btn-primary btn-sm desktop-only"><Plus size={16} /> Post an ad</Link>
        </div>
      </div>

      {notice && (
        <div role="status" className="trust-banner" style={{ marginBottom: '12px', padding: '10px 12px', fontSize: '0.9rem', color: 'var(--success)' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> {notice}
        </div>
      )}
      {error && <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)', marginBottom: '12px' }}>{error}</div>}

      {listings.length > 0 && (
        <div className="pill-row" role="tablist" aria-label="Listing status" style={{ marginBottom: '12px' }}>
          {visibleTabs.map((t) => (
            <button key={t.id} type="button" role="tab" className="tab-pill" aria-selected={activeTab.id === t.id} onClick={() => setTab(t.id)}>
              {t.label} <span className={`count${t.countTone && counts[t.id] > 0 ? ` ${t.countTone}` : ''}`}>{counts[t.id]}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="muted" style={{ padding: '24px 0' }}>Loading your listings…</p>
      ) : listings.length === 0 ? (
        <EmptyState icon={<Tag size={24} />} title="You haven't posted anything yet" action={<Link to="/create-listing" className="btn-primary"><Plus size={16} /> Sell your first item</Link>}>
          Post photos, set a price and chat with buyers near you.
        </EmptyState>
      ) : (
        <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {shown.map((item) => {
            const review = item.reviews?.[0];
            const tone = item.status === 'REJECTED' || item.status === 'SUSPENDED' || item.status === 'CHANGES_REQUESTED' ? 'danger' : item.status === 'PENDING_REVIEW' ? 'warn' : 'info';
            const toneColor = tone === 'danger' ? 'var(--danger)' : tone === 'warn' ? 'var(--warning)' : 'var(--primary-text)';
            const reasons = item.status === 'PENDING_REVIEW' || item.status === 'REJECTED' ? item.sanitization?.reasons ?? [] : [];
            const sold = item.status === 'SOLD';
            const actions = ACTIONS_BY_STATUS[item.status] ?? [];
            return (
              <article key={item.id} className="card my-row">
                <div className="my-row-top">
                  <Link to={`/listings/${item.id}`} style={{ position: 'relative', flexShrink: 0 }} aria-label={item.title}>
                    {item.media && item.media.length > 0 ? (
                      <img src={item.media[0].url} alt="" style={sold ? { filter: 'grayscale(0.7) brightness(0.8)' } : undefined} />
                    ) : (
                      <span className="noimg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Tag size={22} color="var(--text-muted)" /></span>
                    )}
                    {sold && <span className="chip chip-photo chip-upper" style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>Sold</span>}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <StatusChip status={item.status} verified={!!item.verifiedAt} />
                      <span className="muted" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{timeAgo(item.updatedAt ?? item.createdAt)}</span>
                    </div>
                    <Link to={`/listings/${item.id}`} style={{ display: 'block', fontWeight: 700, fontSize: '1rem', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: sold ? 'var(--text-muted)' : undefined }}>
                      {item.title}
                    </Link>
                    <div className="price" style={{ fontSize: '1.1rem', color: sold ? 'var(--text-muted)' : undefined, textDecoration: sold ? 'line-through' : undefined }}>{formatPrice(item.price)}</div>
                    <div className="muted" style={{ fontSize: '0.76rem' }}>
                      {item.category?.name || 'General'}
                      {item.status === 'LIVE' && item.expiresAt && <> · expires {new Date(item.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                    </div>
                  </div>
                </div>

                {review?.remark && (
                  <div className={`remark-box ${tone}`} style={{ color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: toneColor, fontSize: '0.8rem', marginBottom: '2px' }}>
                      {tone === 'danger' ? <AlertTriangle size={14} /> : <MessageSquareWarning size={14} />}
                      {item.status === 'CHANGES_REQUESTED' ? 'Staff remark' : REVIEW_ACTION_LABELS[review.action] ?? 'Note from Becho'}
                      <span className="muted" style={{ fontWeight: 500 }}>· {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.remark}</div>
                  </div>
                )}
                {item.status === 'CHANGES_REQUESTED' && !review?.remark && (
                  <div className="remark-box danger" style={{ color: 'var(--danger)' }}>Our team asked for changes before this can go live.</div>
                )}
                {item.status === 'PENDING_REVIEW' && !review?.remark && (
                  <div className="remark-box warn" style={{ color: 'var(--text-primary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <Hourglass size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>Our team is reviewing this listing. You’ll get a notification when it’s approved.</span>
                  </div>
                )}
                {reasons.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>
                    Flagged: {reasons.map((r) => REASON_LABELS[r] ?? r).join(', ')}
                  </div>
                )}

                {actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    {actions.map(({ action, label, confirm }) => {
                      const resubmit = action === 'edit' && label.startsWith('Edit &');
                      const cls = action === 'delete'
                        ? 'btn btn-danger-outline btn-sm'
                        : resubmit
                          ? 'btn btn-danger btn-sm'
                          : action === 'submit' || action === 'renew'
                            ? 'btn-primary btn-sm'
                            : 'btn btn-outline btn-sm';
                      return (
                        <button key={action} type="button" disabled={busyId === item.id} onClick={() => runAction(item, action, confirm)} className={cls}>
                          {action === 'edit' && !resubmit && <Pencil size={13} />}
                          {label}
                          {resubmit && <ArrowRight size={14} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
