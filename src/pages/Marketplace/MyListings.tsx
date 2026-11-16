import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useLocation } from '../../context/LocationContext';
import { formatPrice, LISTING_STATUS_LABELS, REVIEW_ACTION_LABELS, timeAgo } from '../../utils/format';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Hourglass, Lock, MapPin, MessageSquare, MessageSquareWarning, Pencil, Plus,
  RotateCcw, Send, Tag, Trash2,
} from 'lucide-react';
import { EmptyState, VerifiedByBecho } from '../../components/ui';

export interface MyListingItem {
  id: string;
  title: string;
  price: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  expiresAt?: string | null;
  category?: { name: string };
  description?: string;
  cityCode?: string;
  publishedAt?: string | null;
  soldAt?: string | null;
  media?: { url: string }[];
  sanitization?: { status: string; reasons: string[] | null } | null;
  verifiedAt?: string | null;
  /** Latest seller-visible staff remark (max 1). */
  reviews?: { action: string; remark: string | null; createdAt: string }[];
}

type Action = 'edit' | 'submit' | 'renew' | 'mark-sold' | 'mark-available' | 'delete' | 'chat';

interface RowAction { action: Action; label: string; confirm?: string; kind: 'primary' | 'soft' | 'deal' | 'plain' | 'danger' }

/** Actions per status. LIVE/RESERVED/SOLD listings can't be edited (the API only allows edits before approval). */
const ACTIONS_BY_STATUS: Record<string, RowAction[]> = {
  DRAFT: [
    { action: 'submit', label: 'Publish', kind: 'primary' },
    { action: 'edit', label: 'Edit draft', kind: 'soft' },
    { action: 'delete', label: 'Delete', confirm: 'Delete this draft?', kind: 'danger' },
  ],
  CHANGES_REQUESTED: [
    { action: 'edit', label: 'Edit & resubmit', kind: 'primary' },
    { action: 'delete', label: 'Delete', confirm: 'Delete this listing?', kind: 'danger' },
  ],
  REJECTED: [
    { action: 'edit', label: 'Edit & resubmit', kind: 'primary' },
    { action: 'delete', label: 'Delete', confirm: 'Delete this listing?', kind: 'danger' },
  ],
  LIVE: [{ action: 'mark-sold', label: 'Mark as sold', confirm: 'Mark this item as sold? Open offers will be closed.', kind: 'soft' }],
  RESERVED: [
    { action: 'mark-sold', label: 'Confirm sale', confirm: 'Confirm the sale? The listing will be marked as sold.', kind: 'deal' },
    { action: 'chat', label: 'Chat with buyer', kind: 'soft' },
    { action: 'mark-available', label: 'Reopen listing', confirm: 'Reopen this listing? The reservation is cancelled and the item goes back on sale.', kind: 'plain' },
  ],
  EXPIRED: [
    { action: 'renew', label: 'Renew', kind: 'primary' },
    { action: 'delete', label: 'Delete', confirm: 'Delete this listing?', kind: 'danger' },
  ],
  SOLD: [{ action: 'delete', label: 'Remove', confirm: 'Remove this listing from your list?', kind: 'danger' }],
};

const REASON_LABELS: Record<string, string> = {
  PROHIBITED_CONTENT: 'may contain prohibited items',
  SUSPICIOUS_PRICING: 'price looks unusual',
  MISSING_REQUIRED_INFORMATION: 'description is too short',
};

/** Status tabs. The first four always show; the others only when they have listings. */
const TABS: { id: string; label: string; statuses: string[]; always?: boolean; countTone?: 'warn' | 'danger' }[] = [
  { id: 'active', label: 'Active', statuses: ['LIVE'], always: true },
  { id: 'reserved', label: 'Reserved', statuses: ['RESERVED'], always: true },
  { id: 'sold', label: 'Sold', statuses: ['SOLD'], always: true },
  { id: 'drafts', label: 'Drafts', statuses: ['DRAFT'], always: true },
  { id: 'review', label: 'Under review', statuses: ['PENDING_REVIEW'], countTone: 'warn' },
  { id: 'changes', label: 'Needs changes', statuses: ['CHANGES_REQUESTED', 'REJECTED', 'SUSPENDED'], countTone: 'danger' },
  { id: 'expired', label: 'Expired', statuses: ['EXPIRED'] },
];

/** Accepted offer per listing (buyer + agreed amount), from GET /offers/received. */
export interface DealInfo { buyerId: string; buyerName: string; amount: number }
interface ReceivedOffer { listingId: string; status: string; amount: number; buyerId: string; buyer: { id: string; displayName: string } }

export function useDeals(listings: { id: string; status: string }[]) {
  const [deals, setDeals] = useState<Record<string, DealInfo>>({});
  const key = listings.filter((l) => l.status === 'RESERVED' || l.status === 'SOLD').map((l) => `${l.id}:${l.status}`).join(',');
  useEffect(() => {
    if (!key) { setDeals({}); return; }
    fetchApi<ReceivedOffer[]>('/offers/received').then((res) => {
      if (!res.success || !res.data) return;
      const out: Record<string, DealInfo> = {};
      for (const o of res.data) {
        if (o.status === 'ACCEPTED' && !out[o.listingId]) out[o.listingId] = { buyerId: o.buyerId, buyerName: o.buyer.displayName, amount: Number(o.amount) };
      }
      setDeals(out);
    });
  }, [key]);
  return deals;
}

const kindClass: Record<RowAction['kind'], string> = {
  primary: 'btn-primary btn-sm', soft: 'btn btn-soft btn-sm', deal: 'btn btn-deal btn-sm', plain: 'btn btn-outline btn-sm', danger: 'btn btn-ghost btn-sm row-danger',
};
const actionIcon = (a: Action) => a === 'edit' ? <Pencil size={14} /> : a === 'mark-sold' ? <CheckCircle2 size={15} /> : a === 'chat' ? <MessageSquare size={14} /> : a === 'mark-available' ? <RotateCcw size={14} /> : a === 'delete' ? <Trash2 size={14} /> : a === 'submit' ? <Send size={14} /> : null;

/** The seller's listings with status tabs, staff remarks and actions (part of the account page). */
export const MyListingsPanel: React.FC<{
  listings: MyListingItem[];
  loading: boolean;
  reload: () => void;
  notice?: string;
}> = ({ listings, loading, reload, notice }) => {
  const navigate = useNavigate();
  const { areas } = useLocation();
  const deals = useDeals(listings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const t of TABS) out[t.id] = listings.filter((l) => t.statuses.includes(l.status)).length;
    return out;
  }, [listings]);
  const visibleTabs = TABS.filter((t) => t.always || counts[t.id] > 0);
  // Start on the first tab that needs attention, else Active.
  const defaultTab = (['changes', 'reserved', 'active', 'review', 'drafts', 'sold', 'expired'].find((id) => counts[id] > 0)) ?? 'active';
  const activeTab = visibleTabs.find((t) => t.id === (tab ?? defaultTab)) ?? visibleTabs[0];
  const shown = listings.filter((l) => activeTab.statuses.includes(l.status));

  const openBuyerChat = async (item: MyListingItem) => {
    const deal = deals[item.id];
    const res = await fetchApi<{ id: string; listingId: string; buyer: { id: string } }[]>('/conversations');
    const conv = res.success && res.data ? res.data.find((c) => c.listingId === item.id && (!deal || c.buyer.id === deal.buyerId)) : undefined;
    navigate(conv ? `/chat?conversationId=${conv.id}` : '/chat');
  };

  const runAction = async (item: MyListingItem, action: Action, confirmText?: string) => {
    if (action === 'edit') { navigate(`/listings/${item.id}/edit`); return; }
    if (action === 'chat') { void openBuyerChat(item); return; }
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
    <section aria-labelledby="my-listings-title" id="my-listings" className="ml-panel">
      <h2 id="my-listings-title" className="sr-only">My listings</h2>
      {notice && (
        <div role="status" className="trust-banner" style={{ marginBottom: '12px', padding: '10px 12px', fontSize: '0.9rem', color: 'var(--success)' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} /> {notice}
        </div>
      )}
      {error && <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)', marginBottom: '12px' }}>{error}</div>}

      <div className="ml-tabs-card">
        <div className="ml-tabs" role="tablist" aria-label="Listing status">
          {visibleTabs.map((t) => (
            <button key={t.id} type="button" role="tab" className={`ml-tab${activeTab.id === t.id ? ' on' : ''}${t.countTone && counts[t.id] > 0 ? ` ${t.countTone}` : ''}`} aria-selected={activeTab.id === t.id} onClick={() => setTab(t.id)}>
              {t.label} ({loading ? '–' : counts[t.id]})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="muted" style={{ padding: '24px 0' }}>Loading your listings…</p>
      ) : listings.length === 0 ? (
        <EmptyState icon={<Tag size={24} />} title="You haven't posted anything yet" action={<Link to="/create-listing" className="btn-primary"><Plus size={16} /> Sell your first item</Link>}>
          Post photos, set a price and chat with buyers near you.
        </EmptyState>
      ) : shown.length === 0 ? (
        <div className="card empty-state" style={{ padding: '32px 20px' }}>
          <p className="secondary">No {activeTab.label.toLowerCase()} listings.</p>
        </div>
      ) : (
        <div role="tabpanel" className="ml-rows">
          {shown.map((item) => {
            const review = item.reviews?.[0];
            const tone = item.status === 'REJECTED' || item.status === 'SUSPENDED' || item.status === 'CHANGES_REQUESTED' ? 'danger' : item.status === 'PENDING_REVIEW' ? 'warn' : 'info';
            const toneColor = tone === 'danger' ? 'var(--danger)' : tone === 'warn' ? 'var(--warning)' : 'var(--primary-text)';
            const reasons = item.status === 'PENDING_REVIEW' || item.status === 'REJECTED' ? item.sanitization?.reasons ?? [] : [];
            const sold = item.status === 'SOLD';
            const reserved = item.status === 'RESERVED';
            const deal = deals[item.id];
            const actions = (ACTIONS_BY_STATUS[item.status] ?? []).map((a) => (a.action === 'chat' && deal ? { ...a, label: `Chat with ${deal.buyerName.split(' ')[0]}` } : a));
            const city = areas.find((a) => a.cityCode === item.cityCode)?.cityName ?? item.cityCode;
            const statusLabel = item.status === 'LIVE' ? 'Active' : LISTING_STATUS_LABELS[item.status]?.label ?? item.status;
            return (
              <article key={item.id} className={`ml-row${reserved ? ' reserved' : ''}`}>
                {reserved && (
                  <div className="ml-deal">
                    <Lock size={15} />
                    <span className="ml-deal-text">
                      {deal ? <>Reserved for <strong>{deal.buyerName}</strong> at <strong>{formatPrice(deal.amount)}</strong></> : 'Reserved: you accepted an offer'}
                    </span>
                    <span className="ml-deal-tag">Deal in progress</span>
                  </div>
                )}
                <div className="ml-body">
                  <Link to={`/listings/${item.id}`} className="ml-media" aria-label={item.title}>
                    {item.media && item.media.length > 0
                      ? <img src={item.media[0].url} alt="" style={sold ? { filter: 'grayscale(0.6) brightness(0.85)' } : undefined} />
                      : <span className="noimg"><Tag size={22} /></span>}
                    <span className={`ml-badge s-${item.status.toLowerCase()}`}>{sold ? 'Sold' : statusLabel}</span>
                  </Link>
                  <div className="ml-info">
                    <div className="ml-meta-top">
                      {item.verifiedAt && <VerifiedByBecho small />}
                      <span className="muted">{item.verifiedAt ? '· ' : ''}{item.category?.name || 'General'}</span>
                    </div>
                    <Link to={`/listings/${item.id}`} className="ml-title">{item.title}</Link>
                    {item.description && <div className="ml-desc">{item.description}</div>}
                    <div className="ml-price-row">
                      {reserved && deal ? (
                        <>
                          <span className="ml-label">Deal price:</span>
                          <span className="ml-price deal">{formatPrice(deal.amount)}</span>
                          {deal.amount !== Number(item.price) && <span className="muted ml-was">Listed: <s>{formatPrice(item.price)}</s></span>}
                        </>
                      ) : sold ? (
                        <>
                          <span className="ml-label">{deal ? 'Sold for:' : 'Listed at:'}</span>
                          <span className="ml-price">{formatPrice(deal ? deal.amount : item.price)}</span>
                        </>
                      ) : (
                        <span className="ml-price">{formatPrice(item.price)}</span>
                      )}
                    </div>
                    <div className="ml-foot">
                      {city && <span><MapPin size={14} /> {city}</span>}
                      <span>
                        {sold && item.soldAt ? `Sold ${timeAgo(item.soldAt)}` : item.status === 'LIVE' && item.publishedAt ? `Listed ${timeAgo(item.publishedAt)}` : `Updated ${timeAgo(item.updatedAt ?? item.createdAt)}`}
                      </span>
                      {item.status === 'LIVE' && item.expiresAt && <span>Expires {new Date(item.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                    </div>
                  </div>
                  {actions.length > 0 && (
                    <div className="ml-actions">
                      {actions.map(({ action, label, confirm, kind }) => (
                        <button key={action} type="button" disabled={busyId === item.id} onClick={() => runAction(item, action, confirm)} className={kindClass[kind]}>
                          {actionIcon(action)} {label}
                          {label.startsWith('Edit &') && <ArrowRight size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
