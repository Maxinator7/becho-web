import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CheckCircle2, AlertCircle, Lock, Mail, PauseCircle, Phone, PlayCircle, ShieldAlert, StickyNote, Unlock, UserCheck, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/format';
import type { AdminUserDetail, StaffNote } from '../types';
import {
  Button, Card, CopyButton, EmptyState, ErrorBanner, ListingStatusPill, Loading, Mini, Modal, Pill, ReasonDialog, Thumb, UserStatusPill,
  apiError, fmtDate, fmtDateTime, fmtMonthYear, fmtNum, fmtPhone, humanize, initials, timeAgo, useToast,
} from '../ui';
import { isLocked } from '../filters';

const HISTORY_LABELS: Record<string, string> = {
  USER_SUSPENDED: 'Account suspended',
  USER_BANNED: 'Account banned',
  USER_ACTIVE: 'Account reactivated',
  USER_UNLOCKED: 'Sign-in lock cleared',
  ACCOUNT_LOCKED: 'Locked after failed sign-ins',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_CHANGED: 'Password changed',
};
const HISTORY_DOT: Record<string, string> = {
  USER_SUSPENDED: 'var(--a-danger)',
  USER_BANNED: 'var(--a-danger)',
  ACCOUNT_LOCKED: 'var(--a-warning)',
  USER_ACTIVE: 'var(--a-success)',
  USER_UNLOCKED: 'var(--a-success)',
};

type StatusAction = { status: 'SUSPENDED' | 'BANNED' | 'ACTIVE' };

const IdCell: React.FC<{ ok: boolean | null; title: string; body: React.ReactNode }> = ({ ok, title, body }) => (
  <div className="a-idcell">
    {ok === null ? <AlertCircle size={16} color="var(--a-muted)" style={{ flexShrink: 0, marginTop: 1 }} />
      : ok ? <CheckCircle2 size={16} color="var(--a-success)" style={{ flexShrink: 0, marginTop: 1 }} />
      : <AlertCircle size={16} color="var(--a-warning)" style={{ flexShrink: 0, marginTop: 1 }} />}
    <div style={{ minWidth: 0 }}>
      <div className="a-idcell__title">{title}</div>
      <div className="a-idcell__body">{body}</div>
    </div>
  </div>
);

/** Profile panel for one user: identity checks, listings snapshot, history, staff notes and account actions. */
export const UserPanel: React.FC<{ id: string; onClose: () => void; onChanged: () => void }> = ({ id, onClose, onChanged }) => {
  const { user: me } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [note, setNote] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [unlockBusy, setUnlockBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetchApi<AdminUserDetail>(`/admin/users/${id}`);
    if (res.success && res.data) setData(res.data);
    else if (res.error?.code === 'NOT_FOUND' || res.error?.code === 'USER_NOT_FOUND' || res.error?.code === 'VALIDATION_ERROR') setNotFound(true);
    else setError(apiError(res, 'Could not load this user'));
  }, [id]);

  useEffect(() => {
    setData(null);
    setNotFound(false);
    setNote('');
    setNoteError(null);
    load();
  }, [load]);

  const closeBtn = (
    <button type="button" className="a-iconbtn" onClick={onClose} aria-label="Close profile" title="Close profile" style={{ width: 30, height: 30 }}>
      <X size={16} />
    </button>
  );

  if (notFound) {
    return <Card actions={closeBtn} title="User not found"><EmptyState title="This account doesn’t exist or the link is wrong." /></Card>;
  }
  if (!data) {
    return <Card actions={closeBtn} title="User profile">{error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}</Card>;
  }

  const { user, stats, recentListings, notes, history } = data;
  const isAdmin = me?.role === 'ADMIN';
  const isStaffTarget = user.role === 'ADMIN' || user.role === 'MODERATOR';
  const isSelf = me?.id === user.id;
  const locked = isLocked(user.lockedUntil);
  const blocked = user.status === 'SUSPENDED' || user.status === 'BANNED';
  const statusDisabledReason = !isAdmin
    ? 'Only admins can change account status'
    : isSelf
      ? 'You can’t change your own account status'
      : isStaffTarget
        ? 'Staff accounts can’t be suspended or banned here'
        : undefined;

  const unlock = async () => {
    setUnlockBusy(true);
    const res = await fetchApi(`/admin/users/${user.id}/unlock`, { method: 'POST', body: '{}' });
    setUnlockBusy(false);
    if (res.success) toast('success', 'Sign-in lock cleared.');
    else toast('danger', apiError(res, 'Could not unlock'));
    load();
    onChanged();
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = note.trim();
    if (text.length < 2) {
      setNoteError('Write a note first.');
      return;
    }
    setNoteBusy(true);
    setNoteError(null);
    const res = await fetchApi<StaffNote>(`/admin/users/${user.id}/notes`, { method: 'POST', body: JSON.stringify({ note: text }) });
    setNoteBusy(false);
    if (!res.success) {
      setNoteError(apiError(res, 'Could not save the note'));
      return;
    }
    setNote('');
    toast('success', 'Note added.');
    load();
  };

  const listingStatuses = Object.entries(stats.listingsByStatus).sort((a, b) => b[1] - a[1]);
  const totalListings = listingStatuses.reduce((s, [, n]) => s + n, 0);
  const activeListings = (stats.listingsByStatus.LIVE ?? 0) + (stats.listingsByStatus.RESERVED ?? 0);
  const snapshot = recentListings.slice(0, 3);

  // History newest first, ending with the account's registration.
  const timeline = [
    ...history.map((h, i) => {
      const d = (h.details ?? {}) as Record<string, unknown>;
      const reason = typeof d.reason === 'string' ? d.reason : null;
      const by = h.actorId && h.actorId !== user.id ? (h.actorId === me?.id ? 'by you' : `by ${h.actor?.displayName ?? 'staff'}`) : h.actorId === user.id ? 'by the user' : '';
      return { key: h.id ?? `h${i}`, title: HISTORY_LABELS[h.action] ?? humanize(h.action), at: h.createdAt, body: [reason && `“${reason}”`, by].filter(Boolean).join(' · '), dot: HISTORY_DOT[h.action] };
    }),
    { key: 'registered', title: 'Account registered', at: user.createdAt, body: user.role !== 'USER' ? `${humanize(user.role)} account` : 'Signed up on Becho', dot: 'var(--a-primary)' },
  ];

  return (
    <Card>
      {/* Identity */}
      <div className="a-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 14 }}>
        <span className="a-avatar a-avatar--lg" aria-hidden>{initials(user.displayName)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="a-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{user.displayName}</h2>
            {closeBtn}
          </div>
          <div className="a-row" style={{ gap: 4 }}>
            <span className="a-mono a-small a-text-2">{user.userCode}</span>
            <CopyButton value={user.userCode} label="Copy user code" />
          </div>
          <div className="a-row" style={{ gap: 6, marginTop: 6 }}>
            <UserStatusPill status={user.status} />
            {user.role !== 'USER' && <Pill tone="accent" round>{humanize(user.role)}</Pill>}
            {locked && <Pill tone="warning" round icon={<Lock size={11} />}>Sign-in locked</Pill>}
          </div>
          <div className="a-small a-text-2" style={{ marginTop: 6 }}>
            Member since {fmtMonthYear(user.createdAt)} · last sign-in {timeAgo(user.lastLoginAt).toLowerCase()}
          </div>
        </div>
      </div>

      {blocked && user.statusReason && (
        <div className="a-banner a-banner--danger" style={{ marginTop: 14 }}>
          <ShieldAlert size={16} />
          <div><strong>{humanize(user.status)}:</strong> {user.statusReason}</div>
        </div>
      )}

      {/* Identity checks */}
      <div className="a-card--soft" style={{ borderRadius: 10, padding: 12, marginTop: 16 }}>
        <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Identity &amp; account checks</span>
          {user.emailVerifiedAt && user.phoneVerifiedAt ? <span className="a-small" style={{ fontWeight: 700, color: 'var(--a-success-text)' }}>ALL CLEAR</span> : null}
        </div>
        <div className="a-idgrid">
          <IdCell
            ok={user.email ? !!user.emailVerifiedAt : null}
            title="Email"
            body={user.email ? (user.emailVerifiedAt ? `Verified ${fmtDate(user.emailVerifiedAt)}` : 'Not verified') : 'Not on file'}
          />
          <IdCell
            ok={user.phone ? !!user.phoneVerifiedAt : null}
            title="Mobile"
            body={user.phone ? (user.phoneVerifiedAt ? `OTP verified ${fmtDate(user.phoneVerifiedAt)}` : 'On file, not verified') : 'Not on file'}
          />
          <IdCell ok={user.status === 'ACTIVE'} title="Account status" body={humanize(user.status)} />
          <IdCell
            ok={!locked && user.failedLoginCount === 0}
            title="Sign-in"
            body={locked ? `Locked until ${new Date(user.lockedUntil!).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}` : user.failedLoginCount > 0 ? `${user.failedLoginCount} failed attempt${user.failedLoginCount === 1 ? '' : 's'}` : 'No failed attempts'}
          />
        </div>
        <div className="a-stack" style={{ gap: 6, marginTop: 10, fontSize: 13 }}>
          <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}><Phone size={14} className="a-muted" /> {fmtPhone(user.phone)}</span>
          <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap', minWidth: 0 }}><Mail size={14} className="a-muted" /> <span className="a-ellipsis">{user.email ?? '—'}</span></span>
        </div>
      </div>

      {/* Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
        <Mini label="Listings" value={fmtNum(totalListings)} hint={`${fmtNum(activeListings)} active`} />
        <Mini label="Deals" value={fmtNum(stats.dealsAsBuyer + stats.dealsAsSeller)} hint={`${stats.dealsAsSeller} sold · ${stats.dealsAsBuyer} bought`} />
        <Mini label="Offers" value={fmtNum(stats.offersMade + stats.offersReceived)} hint={`${stats.offersMade} made · ${stats.offersReceived} got`} />
      </div>

      {/* Listings snapshot */}
      <div style={{ marginTop: 20 }}>
        <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>Listings snapshot{totalListings > 0 ? ` (${snapshot.length} of ${totalListings})` : ''}</h3>
          {totalListings > 0 && <Link className="a-link a-small" to={`/listings?sellerId=${user.id}`}>View all ({totalListings})</Link>}
        </div>
        {snapshot.length === 0 ? (
          <div className="a-small a-text-2">No listings yet.</div>
        ) : (
          <ul className="a-stack" style={{ gap: 8 }}>
            {snapshot.map((l) => (
              <li key={l.id}>
                <Link to={`/listings/${l.id}`} className="a-card--soft" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 8, borderRadius: 10 }}>
                  <Thumb url={l.media?.[0]?.url} size={48} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="a-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                      <span className="a-ellipsis" style={{ fontWeight: 600, fontSize: 13 }}>{l.title}</span>
                      <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{formatPrice(l.price)}</span>
                    </div>
                    <div className="a-row" style={{ gap: 6, marginTop: 4 }}>
                      <ListingStatusPill status={l.status} />
                      {l.verifiedAt && <Pill tone="success">Verified</Pill>}
                      <span className="a-small a-muted">{l.cityCode}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Trust &amp; audit timeline</h3>
        <ol className="a-timeline">
          {timeline.map((t) => (
            <li key={t.key}>
              <span className="a-timeline__dot" style={{ background: t.dot }} />
              <div>
                <div className="a-timeline__head">
                  <span>{t.title}</span>
                  <span className="a-timeline__time" title={fmtDateTime(t.at)}>{fmtDate(t.at)}</span>
                </div>
                {t.body && <div className="a-timeline__body">{t.body}</div>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Notes */}
      <div className="a-card--soft" style={{ borderRadius: 10, padding: 12, marginTop: 20 }}>
        <div className="a-row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="a-row" style={{ gap: 6, fontSize: 13, fontWeight: 700 }}><StickyNote size={15} color="var(--a-primary-text)" /> Internal staff notes</span>
          <span className="a-small a-text-2">Staff only</span>
        </div>
        {notes.length === 0 ? (
          <div className="a-small a-text-2" style={{ marginBottom: 10 }}>No notes yet.</div>
        ) : (
          <ul className="a-stack" style={{ gap: 8, marginBottom: 10 }}>
            {notes.map((n) => (
              <li key={n.id} className="a-note" style={{ background: 'var(--a-surface)' }}>
                <div className="a-note__head">
                  <span>{n.author?.displayName ?? 'Staff'}</span>
                  <span className="a-note__time">{fmtDateTime(n.createdAt)}</span>
                </div>
                <div className="a-note__body">{n.note}</div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addNote}>
          <label htmlFor="staff-note" className="a-sr">Add an internal note (never shown to the user)</label>
          <textarea
            id="staff-note"
            rows={3}
            value={note}
            onChange={(e) => { setNote(e.target.value); setNoteError(null); }}
            placeholder="Record an internal observation, call log or concern…"
            className="a-textarea"
            aria-invalid={!!noteError}
          />
          {noteError && <div className="a-field-err">{noteError}</div>}
          <div className="a-row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <span className="a-small a-text-2">Never shown to the user</span>
            <Button type="submit" variant="ink" small loading={noteBusy} disabled={!note.trim()}>Add note</Button>
          </div>
        </form>
      </div>

      {/* Actions */}
      <div className="a-stack" style={{ gap: 8, marginTop: 20 }}>
        {locked && <Button block icon={<Unlock size={15} />} loading={unlockBusy} onClick={unlock}>Unlock sign-in</Button>}
        {blocked && (
          <Button block variant="success" icon={<PlayCircle size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'ACTIVE' })}>
            Reactivate account
          </Button>
        )}
        <div className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          {user.status !== 'SUSPENDED' && (
            <Button block variant="danger" icon={<PauseCircle size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'SUSPENDED' })}>
              Suspend
            </Button>
          )}
          {user.status !== 'BANNED' && (
            <Button block variant="danger-solid" icon={<Ban size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'BANNED' })}>
              Ban
            </Button>
          )}
        </div>
        {statusDisabledReason && (
          <span className="a-row a-small a-text-2" style={{ gap: 6 }}><UserCheck size={13} /> {statusDisabledReason}</span>
        )}
      </div>

      {action && action.status !== 'ACTIVE' && (
        <ReasonDialog
          title={action.status === 'BANNED' ? `Ban ${user.displayName}?` : `Suspend ${user.displayName}?`}
          description={
            <>
              {action.status === 'BANNED' ? 'A ban is meant to be permanent. ' : 'A suspension can be lifted later. '}
              The user will be signed out everywhere, their pending offers cancelled and their listings hidden from the marketplace. They’ll see your reason when they try to sign in.
            </>
          }
          label="Reason"
          placeholder="e.g. Repeated fake listings reported by buyers"
          confirmLabel={action.status === 'BANNED' ? 'Ban account' : 'Suspend account'}
          variant="danger-solid"
          minLength={5}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            const res = await fetchApi(`/admin/users/${user.id}/status`, { method: 'POST', body: JSON.stringify({ status: action.status, reason }) });
            if (!res.success) return apiError(res, 'Could not change status');
            toast('success', `${user.displayName} has been ${action.status === 'BANNED' ? 'banned' : 'suspended'}.`);
            setAction(null);
            load();
            onChanged();
            return null;
          }}
        />
      )}
      {action?.status === 'ACTIVE' && (
        <ReactivateDialog name={user.displayName} userId={user.id} onClose={() => setAction(null)} onDone={() => { setAction(null); load(); onChanged(); }} />
      )}
    </Card>
  );
};

const ReactivateDialog: React.FC<{ name: string; userId: string; onClose: () => void; onDone: () => void }> = ({ name, userId, onClose, onDone }) => {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await fetchApi(`/admin/users/${userId}/status`, { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) });
    setBusy(false);
    if (!res.success) {
      setError(apiError(res, 'Could not reactivate'));
      return;
    }
    toast('success', `${name} is active again.`);
    onDone();
  };
  return (
    <Modal
      title={`Reactivate ${name}?`}
      onClose={onClose}
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="ink" loading={busy} onClick={confirm}>Reactivate</Button></>}
    >
      {error && <div style={{ marginBottom: 12 }}><ErrorBanner message={error} /></div>}
      <p style={{ fontSize: 14, color: 'var(--a-text-2)' }}>
        They’ll be able to sign in again and their listings will be visible on the marketplace. Cancelled offers are not restored.
      </p>
    </Modal>
  );
};
