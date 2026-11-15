import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { formatPrice } from '../../utils/format';
import type { Sanitization } from '../types';
import { Button, Card, EmptyState, ErrorBanner, ListingStatusPill, Loading, PageHeader, Pill, ReasonDialog, Thumb, apiError, fmtDateTime, useToast } from '../ui';

interface QueueItem {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  cityCode: string;
  seller?: { id: string; displayName: string; email: string | null; phone: string | null };
  category?: { name: string };
  sanitization?: Sanitization | null;
  media?: { url: string; mediaType: string }[];
}

export const ReviewQueuePage: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchApi<QueueItem[]>('/admin/moderation/queue');
    if (res.success && res.data) setItems(res.data);
    else setError(apiError(res, 'Could not load the review queue'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (item: QueueItem) => {
    setBusy(item.id);
    const res = await fetchApi(`/admin/moderation/listings/${item.id}/approve`, { method: 'POST', body: '{}' });
    setBusy(null);
    if (res.success) toast('success', `Approved “${item.title}” — it is now live.`);
    else toast('danger', apiError(res, 'Could not approve'));
    load();
  };

  return (
    <div>
      <PageHeader
        title="Review queue"
        subtitle={items ? `${items.length} listing${items.length === 1 ? '' : 's'} waiting for review, oldest first` : 'Listings flagged by automated checks or waiting for review'}
      />
      {error && <div style={{ marginBottom: '1rem' }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!items && !error && <Loading />}
      {items && items.length === 0 && (
        <Card><EmptyState icon={<ShieldCheck size={32} />} title="Queue is clear">No flagged or pending listings right now.</EmptyState></Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {items?.map((item) => {
          const reasons = item.sanitization?.reasons ?? [];
          const score = item.sanitization?.score;
          return (
            <Card key={item.id}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Thumb url={item.media?.[0]?.url} mediaType={item.media?.[0]?.mediaType} size={72} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link to={`/listings/${item.id}`} className="adm-link" style={{ fontSize: '1.02rem', fontWeight: 700 }}>{item.title}</Link>
                    <ListingStatusPill status={item.status} />
                    {item.sanitization?.status === 'FLAGGED' && <Pill tone="danger" icon={<AlertTriangle size={12} />}>Flagged</Pill>}
                    {typeof score === 'number' && <Pill tone={score >= 0.9 ? 'success' : score >= 0.5 ? 'warning' : 'danger'} title="100% = no red flags">Trust score {Math.round(score * 100)}%</Pill>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {formatPrice(item.price)} · {item.category?.name ?? 'Uncategorised'} · {item.cityCode} · submitted {fmtDateTime(item.submittedAt ?? item.createdAt)}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Seller:{' '}
                    {item.seller ? <Link className="adm-link" to={`/users/${item.seller.id}`}>{item.seller.displayName}</Link> : '—'}
                    {item.seller?.email ? ` · ${item.seller.email}` : ''}
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: '0.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.description}</p>
                  {reasons.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                      {reasons.map((r, i) => <Pill key={i} tone="danger" icon={<AlertTriangle size={11} />}>{r}</Pill>)}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button variant="success" icon={<Check size={15} />} loading={busy === item.id} onClick={() => approve(item)}>Approve</Button>
                  <Button variant="danger" icon={<X size={15} />} disabled={busy === item.id} onClick={() => setRejecting(item)}>Reject</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {rejecting && (
        <ReasonDialog
          title="Reject listing"
          description={<>“{rejecting.title}” will be rejected and the seller notified with your reason.</>}
          label="Reason shown to the seller"
          placeholder="e.g. Prohibited item / misleading photos"
          confirmLabel="Reject listing"
          variant="danger"
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
    </div>
  );
};
