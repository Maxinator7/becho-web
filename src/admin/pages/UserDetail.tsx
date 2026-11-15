import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Clock, Lock, Mail, PauseCircle, Phone, PlayCircle, ShieldAlert, StickyNote, Unlock } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatPrice } from '../../utils/format';
import type { AdminUserDetail, StaffNote } from '../types';
import {
  Button, Card, CopyButton, EmptyState, ErrorBanner, ListingStatusPill, Loading, Modal, Pill, ReasonDialog, StatCard, Thumb,
  UserStatusPill, VerifiedBadge, apiError, fmtDate, fmtDateTime, fmtNum, fmtPhone, humanize, inputStyle, labelStyle, timeAgo, toneText, useToast,
} from '../ui';
import { isLocked } from './Users';

export const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="adm-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
    <ArrowLeft size={15} /> {label}
  </Link>
);

const Verified: React.FC<{ at: string | null; what: string }> = ({ at, what }) =>
  at ? (
    <span title={`${what} verified ${fmtDateTime(at)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: toneText('success'), fontSize: '0.75rem', fontWeight: 600 }}>
      <CheckCircle2 size={13} /> Verified
    </span>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', color: toneText('warning'), fontSize: '0.75rem', fontWeight: 600 }}>
      <Clock size={13} /> Not verified
    </span>
  );

const HISTORY_LABELS: Record<string, string> = {
  USER_SUSPENDED: 'Account suspended',
  USER_BANNED: 'Account banned',
  USER_ACTIVE: 'Account reactivated',
  USER_UNLOCKED: 'Sign-in lock cleared',
  ACCOUNT_LOCKED: 'Locked after failed sign-ins',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_CHANGED: 'Password changed',
};

type StatusAction = { status: 'SUSPENDED' | 'BANNED' | 'ACTIVE' };

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
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
    load();
  }, [load]);

  if (notFound) {
    return (
      <div>
        <BackLink to="/users" label="All users" />
        <Card><EmptyState title="User not found">This account doesn’t exist or the link is wrong.</EmptyState></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <BackLink to="/users" label="All users" />
        {error ? <ErrorBanner message={error} onRetry={load} /> : <Loading />}
      </div>
    );
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

  return (
    <div>
      <BackLink to="/users" label="All users" />

      {/* Header */}
      <Card style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800 }}>{user.displayName}</h1>
              <UserStatusPill status={user.status} />
              {user.role !== 'USER' && <Pill tone="accent">{humanize(user.role)}</Pill>}
              {locked && <Pill tone="warning" icon={<Lock size={12} />}>Sign-in locked</Pill>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {user.userCode} <CopyButton value={user.userCode} label="Copy user code" />
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '0.6rem', fontSize: '0.88rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Phone size={14} color="var(--text-muted)" /> {fmtPhone(user.phone)} {user.phone && <Verified at={user.phoneVerifiedAt} what="Mobile" />}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', overflowWrap: 'anywhere' }}>
                <Mail size={14} color="var(--text-muted)" /> {user.email ?? '—'} {user.email && <Verified at={user.emailVerifiedAt} what="Email" />}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Joined {fmtDate(user.createdAt)} · Last sign-in {timeAgo(user.lastLoginAt)}
              {user.failedLoginCount > 0 && ` · ${user.failedLoginCount} failed sign-in attempt${user.failedLoginCount === 1 ? '' : 's'}`}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {locked && (
                <Button icon={<Unlock size={15} />} loading={unlockBusy} onClick={unlock}>Unlock sign-in</Button>
              )}
              {blocked ? (
                <Button variant="success" icon={<PlayCircle size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'ACTIVE' })}>
                  Reactivate
                </Button>
              ) : null}
              {user.status !== 'SUSPENDED' && (
                <Button variant="danger" icon={<PauseCircle size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'SUSPENDED' })}>
                  Suspend
                </Button>
              )}
              {user.status !== 'BANNED' && (
                <Button variant="danger" icon={<Ban size={15} />} disabled={!!statusDisabledReason} title={statusDisabledReason} onClick={() => setAction({ status: 'BANNED' })}>
                  Ban
                </Button>
              )}
            </div>
            {statusDisabledReason && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldAlert size={13} /> {statusDisabledReason}
              </span>
            )}
          </div>
        </div>
        {blocked && user.statusReason && (
          <div style={{ marginTop: '0.9rem', padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.85rem', background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)' }}>
            <strong style={{ color: toneText('danger') }}>{humanize(user.status)}:</strong> {user.statusReason}
          </div>
        )}
      </Card>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <StatCard
          label="Listings"
          value={fmtNum(totalListings)}
          hint={listingStatuses.length ? listingStatuses.map(([s, n]) => `${n} ${humanize(s).toLowerCase()}`).join(' · ') : 'None yet'}
        />
        <StatCard label="Offers made" value={fmtNum(stats.offersMade)} hint="as buyer" />
        <StatCard label="Offers received" value={fmtNum(stats.offersReceived)} hint="as seller" />
        <StatCard label="Deals" value={fmtNum(stats.dealsAsBuyer + stats.dealsAsSeller)} hint={`${stats.dealsAsBuyer} as buyer · ${stats.dealsAsSeller} as seller`} />
        <StatCard label="Messages sent" value={fmtNum(stats.messagesSent)} />
      </div>

      <div className="adm-grid-main">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
          <Card
            title="Recent listings"
            actions={totalListings > 0 ? <Link className="adm-link" style={{ fontSize: '0.85rem' }} to={`/listings?sellerId=${user.id}`}>View all</Link> : undefined}
          >
            {recentListings.length === 0 ? (
              <EmptyState title="No listings">This user hasn’t created any listings.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentListings.map((l) => (
                  <Link key={l.id} to={`/listings/${l.id}`} className="adm-focus" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.55rem 0.25rem', borderBottom: '1px solid var(--border-subtle)' }}>
                    <Thumb url={l.media?.[0]?.url} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{formatPrice(l.price)} · {l.cityCode} · {fmtDate(l.createdAt)}</div>
                    </div>
                    {l.verifiedAt && <VerifiedBadge small />}
                    <ListingStatusPill status={l.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Account history">
            {history.length === 0 ? (
              <EmptyState title="No history yet">Status changes, locks and password resets appear here.</EmptyState>
            ) : (
              <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {history.map((h, i) => {
                  const d = (h.details ?? {}) as Record<string, unknown>;
                  const reason = typeof d.reason === 'string' ? d.reason : null;
                  return (
                    <li key={h.id ?? i} style={{ display: 'flex', gap: '0.75rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--border-strong)', marginTop: '0.45rem', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{HISTORY_LABELS[h.action] ?? humanize(h.action)}</div>
                        {reason && <div style={{ fontSize: '0.84rem' }}>“{reason}”</div>}
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {fmtDateTime(h.createdAt)}
                          {h.actorId && h.actorId !== user.id ? (h.actorId === me?.id ? ' · by you' : ` · by ${h.actor?.displayName ?? 'staff'}`) : h.actorId === user.id ? ' · by the user' : ''}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <Card title={<><StickyNote size={17} /> Staff notes</>}>
          <form onSubmit={addNote} style={{ marginBottom: '1rem' }}>
            <label htmlFor="staff-note" style={labelStyle}>Add an internal note (never shown to the user)</label>
            <textarea
              id="staff-note"
              rows={3}
              value={note}
              onChange={(e) => { setNote(e.target.value); setNoteError(null); }}
              placeholder="e.g. Called the seller to confirm the car’s RC details."
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            {noteError && <div style={{ color: toneText('danger'), fontSize: '0.8rem', marginTop: '0.25rem' }}>{noteError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <Button type="submit" variant="primary" small loading={noteBusy} disabled={!note.trim()}>Add note</Button>
            </div>
          </form>
          {notes.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No notes yet.</div>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {notes.map((n) => (
                <li key={n.id} style={{ background: 'var(--surface-1)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                  <div style={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{n.note}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {n.author?.displayName ?? 'Staff'} · {fmtDateTime(n.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
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
          variant="danger"
          minLength={5}
          onClose={() => setAction(null)}
          onConfirm={async (reason) => {
            const res = await fetchApi(`/admin/users/${user.id}/status`, { method: 'POST', body: JSON.stringify({ status: action.status, reason }) });
            if (!res.success) return apiError(res, 'Could not change status');
            toast('success', `${user.displayName} has been ${action.status === 'BANNED' ? 'banned' : 'suspended'}.`);
            setAction(null);
            load();
            return null;
          }}
        />
      )}
      {action?.status === 'ACTIVE' && <ReactivateDialog name={user.displayName} userId={user.id} onClose={() => setAction(null)} onDone={() => { setAction(null); load(); }} />}
    </div>
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
      footer={<><Button onClick={onClose} disabled={busy}>Cancel</Button><Button variant="primary" loading={busy} onClick={confirm}>Reactivate</Button></>}
    >
      {error && <div style={{ marginBottom: '0.75rem' }}><ErrorBanner message={error} /></div>}
      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        They’ll be able to sign in again and their listings will be visible on the marketplace. Cancelled offers are not restored.
      </p>
    </Modal>
  );
};
