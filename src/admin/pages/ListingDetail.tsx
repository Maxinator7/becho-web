import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, CheckCircle2, ClipboardList, Clock, ExternalLink, Eye, EyeOff, FileText, Gavel, Images, Mail, PauseCircle,
  Phone, Play, RotateCcw, ShieldCheck, SquarePen, X,
} from 'lucide-react';
import { fetchApi } from '../../api/client';
import { CONDITION_LABELS, formatPrice } from '../../utils/format';
import type { AdminListingDetail, AdminUserDetail } from '../types';
import {
  Button, Card, CheckMark, CopyButton, EmptyState, ErrorBanner, Field, ListingStatusPill, Loading, Pill, ReasonDialog, Tone, UserStatusPill, VerifiedBadge,
  apiError, fmtDateTime, fmtMonthYear, fmtNum, fmtPhone, humanize, initials, notifyQueueChanged, timeAgo, useToast,
} from '../ui';
import { checkLabel, parseCheck, reasonLabel, scoreTone } from '../sanitization';

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL as string | undefined;

const REVIEWABLE = ['PENDING_REVIEW', 'SUBMITTED'];
const VERIFIABLE = ['LIVE', 'RESERVED'];
const CHANGES_FROM = ['LIVE', 'PENDING_REVIEW', 'SUBMITTED'];
const SUSPENDABLE = ['LIVE', 'RESERVED'];

const REVIEW_ACTION: Record<string, [string, Tone]> = {
  APPROVED: ['Approved', 'success'],
  REJECTED: ['Rejected', 'danger'],
  SUSPENDED: ['Suspended', 'danger'],
  VERIFIED: ['Verified', 'success'],
  UNVERIFIED: ['Verification removed', 'neutral'],
  CHANGES_REQUESTED: ['Changes requested', 'warning'],
  REMARK: ['Remark', 'accent'],
};

type Dialog = 'approve' | 'approve-verify' | 'reject' | 'suspend' | 'changes' | 'verify' | 'unverify' | null;

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
  const location = useLocation();
  const toast = useToast();
  const [l, setL] = useState<AdminListingDetail | null>(null);
  const [seller, setSeller] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [active, setActive] = useState(0);
  const [remark, setRemark] = useState('');
  const [remarkVisible, setRemarkVisible] = useState(false);
  const [remarkBusy, setRemarkBusy] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchApi<AdminListingDetail>(`/admin/listings/${id}`);
    if (res.success && res.data) setL(res.data);
    else if (res.error?.code === 'NOT_FOUND' || res.error?.code === 'LISTING_NOT_FOUND' || res.error?.code === 'VALIDATION_ERROR') setNotFound(true);
    else setError(apiError(res, 'Could not load this listing'));
  }, [id]);

  useEffect(() => {
    setL(null);
    setSeller(null);
    setNotFound(false);
    setActive(0);
    load();
  }, [load]);

  const sellerId = l?.seller.id;
  useEffect(() => {
    if (!sellerId) return;
    fetchApi<AdminUserDetail>(`/admin/users/${sellerId}`).then((res) => res.success && res.data && setSeller(res.data));
  }, [sellerId]);

  const fromQueue = (location.state as { from?: string } | null)?.from === 'queue';
  const back = l && REVIEWABLE.includes(l.status) ? { to: '/queue', label: 'Review queue' } : fromQueue ? { to: '/queue', label: 'Review queue' } : { to: '/listings', label: 'Listings' };

  if (notFound) {
    return (
      <div className="a-stack">
        <Link to="/listings" className="a-back"><ArrowLeft size={15} /> Listings</Link>
        <Card><EmptyState title="Listing not found">It may have been deleted, or the link is wrong.</EmptyState></Card>
      </div>
    );
  }
  if (!l) {
    return (
      <div className="a-stack">
        <Link to="/listings" className="a-back"><ArrowLeft size={15} /> Listings</Link>
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
    notifyQueueChanged();
    return null;
  };

  /** Approve a pending listing, then issue the Verified badge. */
  const approveAndVerify = async (note: string): Promise<string | null> => {
    const a = await fetchApi(`/admin/moderation/listings/${l.id}/approve`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) });
    if (!a.success) return apiError(a, 'Could not approve');
    const v = await fetchApi(`/admin/listings/${l.id}/verify`, { method: 'POST', body: JSON.stringify(note ? { remark: note } : {}) });
    setDialog(null);
    load();
    notifyQueueChanged();
    if (!v.success) {
      toast('danger', `Approved, but the Verified badge could not be issued: ${apiError(v, 'unknown error')}`);
      return null;
    }
    toast('success', 'Approved and verified — the listing is live with a Verified badge.');
    return null;
  };

  const addRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = remark.trim();
    if (text.length < 2) {
      setRemarkError('Write at least 2 characters.');
      return;
    }
    setRemarkBusy(true);
    setRemarkError(null);
    const res = await fetchApi(`/admin/listings/${l.id}/remarks`, { method: 'POST', body: JSON.stringify({ remark: text, visibleToSeller: remarkVisible }) });
    setRemarkBusy(false);
    if (!res.success) {
      setRemarkError(apiError(res, 'Could not add the remark'));
      return;
    }
    setRemark('');
    toast('success', remarkVisible ? 'Remark sent to the seller.' : 'Internal note added.');
    load();
  };

  const media = [...l.media].sort((a, b) => a.sortOrder - b.sortOrder);
  const current = media[Math.min(active, media.length - 1)];
  const photos = media.filter((m) => m.mediaType === 'IMAGE').length;
  const videos = media.filter((m) => m.mediaType === 'VIDEO').length;
  const s = l.sanitization;
  const reasons = s?.reasons ?? [];
  const offerStats = Object.entries(l.offerStats ?? {});
  const reviewable = REVIEWABLE.includes(l.status);
  const canVerify = VERIFIABLE.includes(l.status);
  const canChanges = CHANGES_FROM.includes(l.status);
  const canSuspend = SUSPENDABLE.includes(l.status);
  const why = (ok: boolean, allowed: string[]) => (ok ? undefined : `Only for ${allowed.map((x) => humanize(x).toLowerCase()).join(' / ')} listings`);
  const reviews = [...l.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const su = seller?.user;
  const sellerListings = seller ? Object.values(seller.stats.listingsByStatus).reduce((a, b) => a + b, 0) : null;

  return (
    <div>
      {/* Top strip */}
      <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <div className="a-row" style={{ gap: 10 }}>
          <Link to={back.to} className="a-back"><ArrowLeft size={15} /> {back.label}</Link>
          <span className="a-muted">/</span>
          <span className="a-chip a-chip--mono" title={l.id}>{l.id.slice(0, 8).toUpperCase()}-{l.cityCode}</span>
          <ListingStatusPill status={l.status} />
          {l.verifiedAt && <VerifiedBadge />}
          {s?.status === 'FLAGGED' && <Pill tone="danger" round icon={<AlertTriangle size={12} />}>Flagged by checks</Pill>}
        </div>
        <div className="a-row">
          {l.submittedAt && reviewable && (
            <span className="a-chip" style={{ height: 32, padding: '0 10px', background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}>
              <Clock size={14} /> Waiting {timeAgo(l.submittedAt).replace(' ago', '')}
            </span>
          )}
          {MARKETPLACE_URL && ['LIVE', 'RESERVED', 'SOLD'].includes(l.status) && (
            <a className="a-btn a-btn--secondary a-btn--sm" href={`${MARKETPLACE_URL.replace(/\/$/, '')}/listings/${l.id}`} target="_blank" rel="noreferrer">
              <Eye size={14} /> View on marketplace <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      <div className="a-grid-main">
        {/* LEFT */}
        <div className="a-stack">
          <Card>
            <div className="a-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                <div className="a-row" style={{ gap: 10 }}>
                  <span className="a-overline">{l.category ? `${l.category.parent ? `${l.category.parent.name} • ` : ''}${l.category.name}` : 'Uncategorised'}</span>
                  <span className="a-small a-text-2">
                    {l.submittedAt ? `Submitted ${timeAgo(l.submittedAt)}` : `Created ${timeAgo(l.createdAt)}`} · {l.cityCode}, {l.stateCode}
                  </span>
                </div>
                <h1 className="a-h1" style={{ fontSize: 28 }}>{l.title}</h1>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{formatPrice(l.price, l.currency)}</div>
                <div className="a-small a-text-2">Asking price</div>
              </div>
            </div>
            <div className="a-row" style={{ gap: 8, marginTop: 14 }}>
              <span className="a-chip" style={{ background: 'var(--a-surface-3)', color: 'var(--a-text)', fontWeight: 500 }}>{CONDITION_LABELS[l.condition] ?? humanize(l.condition)}</span>
              {l.attributes
                .filter((a) => a.valueBoolean !== false)
                .slice(0, 4)
                .map((a) => (
                  <span key={a.id} className="a-chip" style={{ background: 'var(--a-surface-3)', color: 'var(--a-text)', fontWeight: 500 }}>
                    {a.valueBoolean === true ? a.attributeDefinition?.name ?? 'Yes' : attrValue(a)}
                  </span>
                ))}
            </div>
          </Card>

          <Card
            title={<><Images size={18} color="var(--a-primary-text)" /> Photos &amp; video ({photos} photo{photos === 1 ? '' : 's'}{videos ? ` + ${videos} video${videos === 1 ? '' : 's'}` : ''})</>}
          >
            {media.length === 0 ? (
              <EmptyState title="No photos or videos" />
            ) : (
              <>
                <div className="a-stage">
                  {current.mediaType === 'VIDEO' ? (
                    <video key={current.id} src={current.url} controls />
                  ) : (
                    <img src={current.url} alt={`${l.title} — photo ${active + 1}`} />
                  )}
                  <div className="a-stage__tag">
                    <span>{current.mediaType === 'VIDEO' ? 'Video' : 'Photo'} {active + 1} of {media.length}</span>
                    {active === 0 && <span className="is-cover">Cover photo</span>}
                  </div>
                </div>
                {media.length > 1 && (
                  <div className="a-thumbs">
                    {media.map((m, i) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setActive(i)}
                        aria-label={`Show ${m.mediaType === 'VIDEO' ? 'video' : 'photo'} ${i + 1}`}
                        aria-current={i === active}
                      >
                        {m.mediaType === 'VIDEO' ? (
                          <>
                            <video src={m.url} muted preload="metadata" />
                            <span className="a-thumbs__video"><Play size={18} /></span>
                          </>
                        ) : (
                          <img src={m.url} alt="" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          <Card title={<><ClipboardList size={18} color="var(--a-primary-text)" /> Listing details</>}>
            <div className="a-kv">
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
              <Field label="Listing ID"><span className="a-mono" style={{ fontSize: 12 }}>{l.id}</span></Field>
            </div>
            {l.attributes.length > 0 && (
              <div className="a-card--soft" style={{ borderRadius: 10, padding: 16, marginTop: 18 }}>
                <div className="a-section-label" style={{ marginBottom: 10 }}>Attributes from the seller</div>
                <div className="a-kv">
                  {l.attributes.map((a) => <Field key={a.id} label={a.attributeDefinition?.name ?? 'Attribute'}>{attrValue(a)}</Field>)}
                </div>
              </div>
            )}
          </Card>

          <Card
            title={<><FileText size={18} color="var(--a-primary-text)" /> Seller listing notes</>}
            actions={<span className="a-small a-text-2">Character count: {fmtNum(l.description.length)}</span>}
          >
            <blockquote className="a-quote">{l.description || 'No description.'}</blockquote>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="a-stack">
          <Card>
            <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <span className="a-section-label">Seller</span>
              {su && (su.emailVerifiedAt && su.phoneVerifiedAt
                ? <Pill tone="success" round icon={<ShieldCheck size={12} />}>Email &amp; mobile verified</Pill>
                : <Pill tone="warning" round>Partly verified</Pill>)}
            </div>
            <div className="a-row" style={{ gap: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <span className="a-avatar a-avatar--lg" aria-hidden style={{ borderRadius: 12 }}>{initials(l.seller.displayName)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="a-row" style={{ justifyContent: 'space-between' }}>
                  <Link to={`/users/${l.seller.id}`} style={{ fontSize: 18, fontWeight: 700 }}>{l.seller.displayName}</Link>
                </div>
                <div className="a-row" style={{ gap: 4 }}>
                  <span className="a-mono a-small a-text-2">{l.seller.userCode}</span>
                  <CopyButton value={l.seller.userCode} label="Copy user code" />
                  <UserStatusPill status={l.seller.status} />
                </div>
                <div className="a-small a-text-2" style={{ marginTop: 2 }}>
                  Member since {fmtMonthYear(l.seller.createdAt ?? su?.createdAt)}
                  {seller && ` · ${fmtNum(sellerListings)} listing${sellerListings === 1 ? '' : 's'} · ${fmtNum(seller.stats.listingsByStatus.SOLD ?? 0)} sold`}
                </div>
              </div>
            </div>
            <div className="a-card--soft" style={{ borderRadius: 10, padding: 12, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="a-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span className="a-row" style={{ gap: 8, minWidth: 0, flexWrap: 'nowrap' }}><Phone size={15} className="a-muted" /> <span className="a-ellipsis">{fmtPhone(l.seller.phone)}</span></span>
                {l.seller.phone && su && <CheckMark ok={!!su.phoneVerifiedAt} okLabel="OTP verified" />}
              </div>
              <div className="a-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span className="a-row" style={{ gap: 8, minWidth: 0, flexWrap: 'nowrap' }}><Mail size={15} className="a-muted" /> <span className="a-ellipsis">{l.seller.email ?? '—'}</span></span>
                {l.seller.email && su && <CheckMark ok={!!su.emailVerifiedAt} />}
              </div>
            </div>
            <Link to={`/listings?sellerId=${l.seller.id}`} className="a-link a-small" style={{ display: 'inline-block', marginTop: 12 }}>All listings by this seller →</Link>
          </Card>

          <Card title={<><Gavel size={18} color="var(--a-primary-text)" /> Moderator decision</>}>
            <div className="a-stack" style={{ gap: 8 }}>
              {reviewable && (
                <>
                  <Button variant="ink" block large icon={<BadgeCheck size={17} />} onClick={() => setDialog('approve-verify')}>Approve &amp; issue Verified badge</Button>
                  <Button variant="secondary" block icon={<CheckCircle2 size={15} />} onClick={() => setDialog('approve')}>Approve without badge</Button>
                </>
              )}
              {!reviewable && (l.verifiedAt ? (
                <Button variant="secondary" block icon={<RotateCcw size={15} />} onClick={() => setDialog('unverify')}>Remove Verified badge</Button>
              ) : (
                <Button variant="ink" block large icon={<BadgeCheck size={17} />} disabled={!canVerify} title={why(canVerify, VERIFIABLE)} onClick={() => setDialog('verify')}>
                  Issue “Verified” badge
                </Button>
              ))}
              <Button variant="soft" block icon={<SquarePen size={15} />} disabled={!canChanges} title={why(canChanges, CHANGES_FROM)} onClick={() => setDialog('changes')}>
                Request changes from seller
              </Button>
              {reviewable ? (
                <Button variant="danger" block icon={<X size={15} />} onClick={() => setDialog('reject')}>Reject listing</Button>
              ) : (
                <Button variant="danger" block icon={<PauseCircle size={15} />} disabled={!canSuspend} title={why(canSuspend, SUSPENDABLE)} onClick={() => setDialog('suspend')}>
                  Suspend listing
                </Button>
              )}
              {!reviewable && !canVerify && !l.verifiedAt && (
                <div className="a-small a-muted">Verification is only available for live or reserved listings.</div>
              )}
            </div>

            <div className="a-card--soft" style={{ borderRadius: 10, padding: 14, marginTop: 16 }}>
              <div className="a-section-label" style={{ marginBottom: 8 }}>Automated check</div>
              {!s ? (
                <div className="a-small a-text-2">No automated check recorded for this listing.</div>
              ) : (
                <>
                  <div className="a-row" style={{ justifyContent: 'space-between' }}>
                    <Pill tone={s.status === 'PASSED' ? 'success' : s.status === 'FLAGGED' ? 'danger' : 'warning'} icon={s.status === 'PASSED' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}>
                      {humanize(s.status)}
                    </Pill>
                    <span className="a-small a-text-2" title="100% = no red flags found">Trust score <strong style={{ color: 'var(--a-text)' }}>{Math.round((s.score ?? 0) * 100)}%</strong></span>
                  </div>
                  <div className="a-meter" role="meter" aria-label="Trust score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((s.score ?? 0) * 100)} style={{ marginTop: 10 }}>
                    <span style={{ width: `${Math.min(100, Math.round((s.score ?? 0) * 100))}%`, background: `var(--a-${scoreTone(s.score ?? 0)})` }} />
                  </div>
                  {reasons.length > 0 && (
                    <ul className="a-stack" style={{ gap: 6, marginTop: 10 }}>
                      {reasons.map((r) => (
                        <li key={r} className="a-row" style={{ gap: 6, fontSize: 13, color: 'var(--a-danger-text)', fontWeight: 600 }}><AlertTriangle size={14} /> {reasonLabel(r)}</li>
                      ))}
                    </ul>
                  )}
                  {s.checks && typeof s.checks === 'object' && (
                    <ul className="a-stack" style={{ gap: 6, marginTop: 10 }}>
                      {Object.entries(s.checks).map(([k, v]) => {
                        const c = parseCheck(v);
                        return (
                          <li key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
                            <span className="a-text-2">{checkLabel(k)}</span>
                            <span style={{ fontWeight: 600, textAlign: 'right', color: c.passed === false ? 'var(--a-danger-text)' : c.passed ? 'var(--a-success-text)' : undefined }}>
                              {c.passed === true ? 'Passed' : c.passed === false ? c.detail || 'Flagged' : c.detail}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </Card>

          <Card title="Buyer activity" small>
            <div className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Offers</div><div className="a-mini__value">{fmtNum(l._count.offers)}</div></div>
              <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Chats</div><div className="a-mini__value">{fmtNum(l._count.conversations)}</div></div>
              <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Saved</div><div className="a-mini__value">{fmtNum(l._count.favorites)}</div></div>
            </div>
            {offerStats.length > 0 && (
              <div className="a-row" style={{ gap: 6, marginTop: 10 }}>
                {offerStats.map(([k, v]) => (
                  <Pill key={k} tone={k === 'ACCEPTED' ? 'success' : k === 'PENDING' || k === 'COUNTERED' ? 'warning' : 'neutral'}>{humanize(k)}: {v}</Pill>
                ))}
              </div>
            )}
          </Card>

          <Card title={<><ClipboardList size={18} color="var(--a-primary-text)" /> Review log</>} actions={<span className="a-small a-text-2" style={{ fontWeight: 600 }}>{reviews.length} record{reviews.length === 1 ? '' : 's'}</span>}>
            {reviews.length === 0 ? (
              <div className="a-small a-text-2" style={{ marginBottom: 14 }}>No staff reviews yet. Approvals, remarks and verification changes appear here.</div>
            ) : (
              <ul className="a-stack" style={{ gap: 8, marginBottom: 14 }}>
                {reviews.map((r, i) => {
                  const [label, tone] = REVIEW_ACTION[r.action] ?? [humanize(r.action), 'neutral' as Tone];
                  return (
                    <li key={r.id ?? i} className="a-note">
                      <div className="a-note__head">
                        <span>{r.reviewer?.displayName ?? 'Staff'}</span>
                        <span className="a-note__time">{fmtDateTime(r.createdAt)}</span>
                      </div>
                      <div className="a-row" style={{ gap: 6, marginBottom: r.remark ? 4 : 0 }}>
                        <Pill tone={tone}>{label}</Pill>
                        <span className="a-row a-small a-muted" style={{ gap: 4 }}>
                          {r.visibleToSeller === false ? <><EyeOff size={12} /> Internal</> : <><Eye size={12} /> Visible to seller</>}
                        </span>
                      </div>
                      {r.remark && <div className="a-note__body">{r.remark}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
            <form onSubmit={addRemark}>
              <label htmlFor="remark" className="a-sr">Add a remark</label>
              <div className="a-row" style={{ flexWrap: 'nowrap', alignItems: 'stretch' }}>
                <input
                  id="remark"
                  className="a-input a-input--soft"
                  placeholder={remarkVisible ? 'Remark for the seller…' : 'Add internal moderation note…'}
                  value={remark}
                  onChange={(e) => { setRemark(e.target.value); setRemarkError(null); }}
                  aria-invalid={!!remarkError}
                  aria-describedby="remark-err"
                />
                <Button type="submit" variant="ink" loading={remarkBusy} disabled={!remark.trim()}>Post</Button>
              </div>
              <label className="a-row a-small" style={{ gap: 8, marginTop: 8, cursor: 'pointer', color: 'var(--a-text-2)' }}>
                <input type="checkbox" className="a-checkbox" checked={remarkVisible} onChange={(e) => setRemarkVisible(e.target.checked)} />
                Visible to seller (they’re notified)
              </label>
              {remarkError && <div id="remark-err" className="a-field-err">{remarkError}</div>}
            </form>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      {dialog === 'approve-verify' && (
        <ReasonDialog
          title="Approve & verify listing"
          description="The listing goes live with a “Verified” badge shown to buyers. The seller is notified."
          label="Note to seller"
          confirmLabel="Approve & verify"
          variant="ink"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={approveAndVerify}
        />
      )}
      {dialog === 'approve' && (
        <ReasonDialog
          title="Approve listing"
          description="The listing goes live on the marketplace and the seller is notified."
          label="Note to seller"
          confirmLabel="Approve"
          variant="ink"
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
          variant="danger-solid"
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
          variant="danger-solid"
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
          onConfirm={(text) => run(`/admin/listings/${l.id}/request-changes`, { remark: text }, 'Changes requested — the seller has been notified.')}
        />
      )}
      {dialog === 'verify' && (
        <ReasonDialog
          title="Verify listing"
          description="A “Verified” badge is shown to buyers and the seller is notified."
          label="Remark"
          confirmLabel="Verify"
          variant="ink"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(text) => run(`/admin/listings/${l.id}/verify`, text ? { remark: text } : {}, 'Listing verified.')}
        />
      )}
      {dialog === 'unverify' && (
        <ReasonDialog
          title="Remove verification"
          description="The “Verified” badge will no longer be shown to buyers."
          label="Remark"
          confirmLabel="Remove verification"
          variant="danger-solid"
          minLength={0}
          onClose={() => setDialog(null)}
          onConfirm={(text) => run(`/admin/listings/${l.id}/unverify`, text ? { remark: text } : {}, 'Verification removed.')}
        />
      )}
    </div>
  );
};
