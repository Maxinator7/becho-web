import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, BadgeCheck, Check, CheckCircle2, Eye, EyeOff, MessageSquarePlus, PauseCircle, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { CONDITION_LABELS, formatPrice } from '../../utils/format';
import type { AdminListingDetail } from '../types';
import {
  Button, Card, EmptyState, ErrorBanner, Field, ListingStatusPill, Loading, Pill, ReasonDialog, Tone, UserStatusPill, VerifiedBadge,
  apiError, fmtDateTime, fmtNum, fmtPhone, humanize, toneText, useToast,
} from '../ui';
import { BackLink } from './UserDetail';

const REVIEWABLE = ['PENDING_REVIEW', 'SUBMITTED'];
const VERIFIABLE = ['LIVE', 'RESERVED'];
const CHANGES_FROM = ['LIVE', 'PENDING_REVIEW', 'SUBMITTED'];
const SUSPENDABLE = ['LIVE', 'RESERVED'];

const REVIEW_ACTION: Record<string, [string, Tone]> = {
  APPROVED: ['Approved', 'success'],
  REJECTED: ['Rejected', 'danger'],
  SUSPENDED: ['Suspended', 'danger'],
  VERIFIED: ['Verified', 'info'],
  UNVERIFIED: ['Verification removed', 'neutral'],
  CHANGES_REQUESTED: ['Changes requested', 'warning'],
  REMARK: ['Remark', 'accent'],
};

type Dialog = 'approve' | 'reject' | 'suspend' | 'changes' | 'remark' | 'verify' | 'unverify' | null;

function attrValue(a: AdminListingDetail['attributes'][number]): string {
  if (a.valueText != null) return a.valueText;
  if (a.valueNumber != null) return fmtNum(a.valueNumber);
  if (a.valueBoolean != null) return a.valueBoolean ? 'Yes' : 'No';
  if (a.valueDate) return fmtDateTime(a.valueDate);
  if (a.valueJson != null) return Array.isArray(a.valueJson) ? a.valueJson.join(', ') : JSON.stringify(a.valueJson);
  return '—';
}

export const ListingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [l, setL] = useState<AdminListingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [active, setActive] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchApi<AdminListingDetail>(`/admin/listings/${id}`);
    if (res.success && res.data) setL(res.data);
    else if (res.error?.code === 'NOT_FOUND' || res.error?.code === 'LISTING_NOT_FOUND' || res.error?.code === 'VALIDATION_ERROR') setNotFound(true);
    else setError(apiError(res, 'Could not load this listing'));
  }, [id]);

  useEffect(() => {
    setL(null);
    setNotFound(false);
    setActive(0);
    load();
  }, [load]);

  if (notFound) {
    return (
      <div>
        <BackLink to="/listings" label="All listings" />
        <Card><EmptyState title="Listing not found">It may have been deleted, or the link is wrong.</EmptyState></Card>
      </div>
    );
  }
  if (!l) {
    return (
      <div>
        <BackLink to="/listings" label="All listings" />
        {error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}
      </div>
    );
  }

  /** Runs an action; returns an error string for the dialog, or null on success. */
  const run = async (path: string, body: Record<string, unknown>, success: string): Promise<string | null> => {
    const res = await fetchApi(path, { method: 'POST', body: JSON.stringify(body) });
    if (!res.success) return apiError(res, 'Action failed');
    toast('success', success);
    setDialog(null);
    load();
    return null;
  };

  const media = [...l.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = media[active];
  const s = l.sanitization;
  const reasons = s?.reasons ?? [];
  const offerStats = Object.entries(l.offerStats ?? {});
  const reviewable = REVIEWABLE.includes(l.status);
  const canVerify = VERIFIABLE.includes(l.status);
  const why = (ok: boolean, allowed: string[]) => (ok ? undefined : `Only for ${allowed.map((x) => humanize(x).toLowerCase()).join(' / ')} listings`);

  return (
    <div>
      <BackLink to="/listings" label="All listings" />

      {/* Title + actions */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <ListingStatusPill status={l.status} />
              {l.verifiedAt && <VerifiedBadge />}
              {s?.status === 'FLAGGED' && <Pill tone="danger" icon={<AlertTriangle size={12} />}>Flagged by checks</Pill>}
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.3 }}>{l.title}</h1>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{formatPrice(l.price, l.currency)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end', flex: '0 1 auto' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {reviewable && (
                <>
                  <Button variant="success" icon={<Check size={15} />} onClick={() => setDialog('approve')}>Approve</Button>
                  <Button variant="danger" icon={<X size={15} />} onClick={() => setDialog('reject')}>Reject</Button>
                </>
              )}
              {l.verifiedAt ? (
                <Button icon={<RotateCcw size={15} />} onClick={() => setDialog('unverify')}>Remove verification</Button>
              ) : (
                <Button icon={<BadgeCheck size={15} />} disabled={!canVerify} title={why(canVerify, VERIFIABLE)} onClick={() => setDialog('verify')}>Verify</Button>
              )}
              <Button icon={<ShieldAlert size={15} />} disabled={!CHANGES_FROM.includes(l.status)} title={why(CHANGES_FROM.includes(l.status), CHANGES_FROM)} onClick={() => setDialog('changes')}>
                Request changes
              </Button>
              <Button icon={<MessageSquarePlus size={15} />} onClick={() => setDialog('remark')}>Add remark</Button>
              <Button variant="danger" icon={<PauseCircle size={15} />} disabled={!SUSPENDABLE.includes(l.status)} title={why(SUSPENDABLE.includes(l.status), SUSPENDABLE)} onClick={() => setDialog('suspend')}>
                Suspend
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="adm-grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          {/* Media */}
          <Card title={`Media (${media.length})`}>
            {media.length === 0 ? (
              <EmptyState title="No photos or videos" />
            ) : (
              <>
                <div style={{ background: 'var(--surface-sunken)', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', aspectRatio: '16 / 10' }}>
                  {current.mediaType === 'VIDEO' ? (
                    <video key={current.id} src={current.url} controls style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
                  ) : (
                    <img src={current.url} alt={`${l.title} — photo ${active + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  )}
                </div>
                {media.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', overflowX: 'auto', paddingBottom: 2 }}>
                    {media.map((m, i) => (
                      <button
                        key={m.id}
                        className="adm-btn"
                        onClick={() => setActive(i)}
                        aria-label={`Show ${m.mediaType === 'VIDEO' ? 'video' : 'photo'} ${i + 1}`}
                        aria-current={i === active}
                        style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', flexShrink: 0, padding: 0, position: 'relative', border: i === active ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)' }}
                      >
                        {m.mediaType === 'VIDEO' ? (
                          <>
                            <video src={m.url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <span style={{ position: 'absolute', bottom: 2, right: 2, fontSize: '0.6rem', background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '0 4px', borderRadius: 4 }}>VIDEO</span>
                          </>
                        ) : (
                          <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Details */}
          <Card title="Details">
            <p style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{l.description}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.9rem' }}>
              <Field label="Category">{l.category ? `${l.category.parent ? `${l.category.parent.name} › ` : ''}${l.category.name}` : '—'}</Field>
              <Field label="Condition">{CONDITION_LABELS[l.condition] ?? humanize(l.condition)}</Field>
              <Field label="Location">{l.cityCode}, {l.stateCode}, {l.countryCode}</Field>
              {l.locationVisibility && <Field label="Location shown">{humanize(l.locationVisibility)}</Field>}
              <Field label="Created">{fmtDateTime(l.createdAt)}</Field>
              <Field label="Submitted">{fmtDateTime(l.submittedAt)}</Field>
              <Field label="Approved">{fmtDateTime(l.approvedAt)}</Field>
              <Field label="Published">{fmtDateTime(l.publishedAt)}</Field>
              <Field label="Expires">{fmtDateTime(l.expiresAt)}</Field>
              {l.verifiedAt && <Field label="Verified">{fmtDateTime(l.verifiedAt)}</Field>}
              {l.reservedAt && <Field label="Reserved">{fmtDateTime(l.reservedAt)}</Field>}
              {l.soldAt && <Field label="Sold">{fmtDateTime(l.soldAt)}</Field>}
              <Field label="Last updated">{fmtDateTime(l.updatedAt)}</Field>
              <Field label="Listing ID"><span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem' }}>{l.id}</span></Field>
            </div>
            {l.attributes.length > 0 && (
              <>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '1.25rem 0 0.6rem' }}>Attributes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.9rem' }}>
                  {l.attributes.map((a) => <Field key={a.id} label={a.attributeDefinition?.name ?? 'Attribute'}>{attrValue(a)}</Field>)}
                </div>
              </>
            )}
          </Card>

          {/* Review history */}
          <Card title="Review history">
            {l.reviews.length === 0 ? (
              <EmptyState title="No staff reviews yet">Approvals, remarks and verification changes appear here.</EmptyState>
            ) : (
              <ol style={{ listStyle: 'none', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                {[...l.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((r, i) => {
                  const [label, tone] = REVIEW_ACTION[r.action] ?? [humanize(r.action), 'neutral' as Tone];
                  return (
                    <li key={r.id ?? i} style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', marginTop: '0.4rem', flexShrink: 0, background: `color-mix(in srgb, ${toneText(tone)} 70%, transparent)` }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Pill tone={tone}>{label}</Pill>
                          {r.visibleToSeller === false ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}><EyeOff size={12} /> Internal</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}><Eye size={12} /> Visible to seller</span>
                          )}
                        </div>
                        {r.remark && <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', whiteSpace: 'pre-wrap' }}>{r.remark}</div>}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {r.reviewer?.displayName ?? 'Staff'} · {fmtDateTime(r.createdAt)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          {/* Seller */}
          <Card title="Seller">
            <Link to={`/users/${l.seller.id}`} className="adm-link" style={{ fontWeight: 700, fontSize: '1rem' }}>{l.seller.displayName}</Link>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.2rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{l.seller.userCode}</span>
              <UserStatusPill status={l.seller.status} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', overflowWrap: 'anywhere' }}>
              <span>{fmtPhone(l.seller.phone)}</span>
              <span>{l.seller.email ?? '—'}</span>
            </div>
            <Link to={`/listings?sellerId=${l.seller.id}`} className="adm-link" style={{ display: 'inline-block', fontSize: '0.82rem', marginTop: '0.6rem' }}>All listings by this seller →</Link>
          </Card>

          {/* Automated check */}
          <Card title="Automated check">
            {!s ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No automated check recorded for this listing.</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <Pill tone={s.status === 'PASSED' ? 'success' : s.status === 'FLAGGED' ? 'danger' : 'warning'} icon={s.status === 'PASSED' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}>
                    {humanize(s.status)}
                  </Pill>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }} title="100% = no problems found; lower means more red flags">
                    Trust score <strong style={{ color: 'var(--text-primary)' }}>{Math.round((s.score ?? 0) * 100)}%</strong>
                  </span>
                </div>
                <div role="meter" aria-label="Trust score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((s.score ?? 0) * 100)} style={{ height: 6, borderRadius: 3, background: 'var(--surface-3)', marginTop: '0.6rem', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.round((s.score ?? 0) * 100))}%`, height: '100%', borderRadius: 3, background: (s.score ?? 0) >= 0.9 ? 'var(--success)' : (s.score ?? 0) >= 0.5 ? 'var(--warning)' : 'var(--danger)' }} />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>100% means no red flags were found.</div>
                {reasons.length > 0 && (
                  <ul style={{ listStyle: 'none', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {reasons.map((r, i) => (
                      <li key={i} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.84rem' }}>
                        <AlertTriangle size={14} style={{ color: toneText('danger'), flexShrink: 0, marginTop: 3 }} /> {r}
                      </li>
                    ))}
                  </ul>
                )}
                {s.checks && typeof s.checks === 'object' && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {Object.entries(s.checks).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{humanize(k.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase())}</span>
                        <span style={{ fontWeight: 600 }}>{typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Offers */}
          <Card title="Activity">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: offerStats.length ? '0.85rem' : 0 }}>
              <Field label="Offers">{fmtNum(l._count.offers)}</Field>
              <Field label="Chats">{fmtNum(l._count.conversations)}</Field>
              <Field label="Saved">{fmtNum(l._count.favorites)}</Field>
            </div>
            {offerStats.length > 0 && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {offerStats.map(([k, v]) => (
                  <Pill key={k} tone={k === 'ACCEPTED' ? 'success' : k === 'PENDING' || k === 'COUNTERED' ? 'warning' : 'neutral'}>{humanize(k)}: {v}</Pill>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      {dialog === 'approve' && (
        <ReasonDialog
          title="Approve listing"
          description="The listing goes live on the marketplace and the seller is notified."
          label="Note to seller"
          confirmLabel="Approve"
          variant="primary"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(note) => run(`/admin/moderation/listings/${l.id}/approve`, note ? { note } : {}, 'Listing approved — it is now live.')}
        />
      )}
      {dialog === 'reject' && (
        <ReasonDialog
          title="Reject listing"
          description="The seller is notified with your reason. If the seller could fix the problem, use “Request changes” instead."
          label="Reason shown to the seller"
          confirmLabel="Reject"
          variant="danger"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => run(`/admin/moderation/listings/${l.id}/reject`, reason ? { reason } : {}, 'Listing rejected.')}
        />
      )}
      {dialog === 'suspend' && (
        <ReasonDialog
          title="Suspend listing"
          description="The listing is removed from the marketplace and its pending offers are cancelled. The seller is notified."
          label="Reason shown to the seller"
          confirmLabel="Suspend"
          variant="danger"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(reason) => run(`/admin/moderation/listings/${l.id}/suspend`, reason ? { reason } : {}, 'Listing suspended.')}
        />
      )}
      {dialog === 'changes' && (
        <ReasonDialog
          title="Request changes"
          description={
            <>
              The listing will be <strong>hidden from the marketplace</strong> and any <strong>open offers cancelled</strong>. The seller is notified with your
              remark and can edit and resubmit it for review.
            </>
          }
          label="What should the seller change?"
          placeholder="e.g. Please add a clear photo of the odometer and the RC book."
          confirmLabel="Request changes"
          variant="primary"
          minLength={5}
          onClose={() => setDialog(null)}
          onConfirm={(remark) => run(`/admin/listings/${l.id}/request-changes`, { remark }, 'Changes requested — the seller has been notified.')}
        />
      )}
      {dialog === 'verify' && (
        <ReasonDialog
          title="Verify listing"
          description="A “Verified” badge is shown to buyers and the seller is notified."
          label="Remark"
          confirmLabel="Verify"
          variant="primary"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(remark) => run(`/admin/listings/${l.id}/verify`, remark ? { remark } : {}, 'Listing verified.')}
        />
      )}
      {dialog === 'unverify' && (
        <ReasonDialog
          title="Remove verification"
          description="The “Verified” badge will no longer be shown to buyers."
          label="Remark"
          confirmLabel="Remove verification"
          variant="danger"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(remark) => run(`/admin/listings/${l.id}/unverify`, remark ? { remark } : {}, 'Verification removed.')}
        />
      )}
      {dialog === 'remark' && (
        <ReasonDialog
          title="Add remark"
          label="Remark"
          placeholder="e.g. Price looks high for a 2019 model — consider revising."
          confirmLabel="Add remark"
          variant="primary"
          minLength={2}
          defaultChecked
          extra={({ checked, setChecked }) => (
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} style={{ marginTop: 4, accentColor: 'var(--accent-primary)' }} />
              <span>
                Visible to seller
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {checked ? 'The seller is notified and sees this remark on their listing.' : 'Internal only — only staff can see this remark.'}
                </span>
              </span>
            </label>
          )}
          onClose={() => setDialog(null)}
          onConfirm={(remark, visibleToSeller) =>
            run(`/admin/listings/${l.id}/remarks`, { remark, visibleToSeller }, visibleToSeller ? 'Remark sent to the seller.' : 'Internal remark added.')
          }
        />
      )}
    </div>
  );
};

