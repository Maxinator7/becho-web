import React, { useEffect, useState } from 'react';
import { Link, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { formatPrice, LISTING_STATUS_LABELS } from '../../utils/format';
import { ShoppingBag, PlusCircle, CheckCircle2 } from 'lucide-react';

interface ListingItem {
  id: string;
  title: string;
  price: number;
  status: string;
  createdAt: string;
  expiresAt?: string | null;
  category?: { name: string };
  media?: { url: string }[];
  sanitization?: { status: string; reasons: string[] | null } | null;
}

type Action = 'submit' | 'renew' | 'mark-sold' | 'mark-available' | 'delete';

const ACTIONS_BY_STATUS: Record<string, { action: Action; label: string; confirm?: string }[]> = {
  DRAFT: [{ action: 'submit', label: 'Publish' }, { action: 'delete', label: 'Delete', confirm: 'Delete this draft?' }],
  REJECTED: [{ action: 'submit', label: 'Resubmit' }, { action: 'delete', label: 'Delete', confirm: 'Delete this listing?' }],
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

export const MyListings: React.FC = () => {
  const notice = ((useRouterLocation().state || {}) as { notice?: string }).notice;
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetchApi<ListingItem[]>('/listings/mine')
      .then((res) => {
        if (res.success && res.data) setListings(res.data);
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const runAction = async (item: ListingItem, action: Action, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(item.id);
    setError(null);
    const res = action === 'delete'
      ? await fetchApi(`/listings/${item.id}`, { method: 'DELETE' })
      : await fetchApi(`/listings/${item.id}/${action}`, { method: 'POST' });
    setBusyId(null);
    if (!res.success) setError(res.error?.message || 'Something went wrong');
    load();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <Navbar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShoppingBag size={24} color="var(--accent-primary)" /> My Listings
        </h1>
        <Link to="/create-listing" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
          <PlusCircle size={16} /> Post New Listing
        </Link>
      </div>

      {notice && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}
      {error && (
        <div style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading your listings...</p>
      ) : listings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>You haven't posted anything yet.</p>
          <Link to="/create-listing" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>Sell your first item</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {listings.map((item) => {
            const status = LISTING_STATUS_LABELS[item.status] ?? { label: item.status, color: '#9ca3af' };
            const reasons = item.status === 'PENDING_REVIEW' || item.status === 'REJECTED' ? item.sanitization?.reasons ?? [] : [];
            return (
              <div key={item.id} className="glass-panel" style={{ padding: '1.25rem', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Link to={`/listings/${item.id}`}>
                  {item.media && item.media.length > 0 ? (
                    <img src={item.media[0].url} alt={item.title} style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} />
                  ) : (
                    <div style={{ width: '100%', height: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      No Image
                    </div>
                  )}
                </Link>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{item.title}</h3>
                  <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: `${status.color}33`, color: status.color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {status.label}
                  </span>
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>{formatPrice(item.price)}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {item.category?.name || 'General'}
                  {item.status === 'LIVE' && item.expiresAt && <> · expires {new Date(item.expiresAt).toLocaleDateString('en-IN')}</>}
                </div>
                {reasons.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '0.5rem' }}>
                    Flagged: {reasons.map((r) => REASON_LABELS[r] ?? r).join(', ')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem', flexWrap: 'wrap' }}>
                  {(ACTIONS_BY_STATUS[item.status] ?? []).map(({ action, label, confirm }) => (
                    <button
                      key={action}
                      disabled={busyId === item.id}
                      onClick={() => runAction(item, action, confirm)}
                      className={action === 'delete' ? undefined : 'btn-primary'}
                      style={{
                        padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '6px', cursor: 'pointer',
                        ...(action === 'delete' ? { background: 'transparent', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444' } : {}),
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
