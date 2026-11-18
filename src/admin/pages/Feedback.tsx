import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bug, CheckCircle2, Clock, ExternalLink, HelpCircle, Inbox, Lightbulb, Mail, Monitor, MoreHorizontal, Phone, Smartphone,
  Star, StickyNote, ThumbsUp, X, XCircle,
} from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { AdminFeedback, AdminFeedbackList, Pagination as PaginationT } from '../types';
import {
  Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, Pagination, Pill, apiError, fmtDateTime, fmtNum, fmtPhone, initials, qs, timeAgo,
  useToast, type Tone,
} from '../ui';
import { ParamSelect, SearchBox, usePageParam } from '../filters';

const PAGE_SIZE = 20;
/** Where WEB feedback page paths live (the marketplace origin). */
const MARKETPLACE_URL = (import.meta.env.VITE_MARKETPLACE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:3000' : undefined);

type Status = AdminFeedback['status'];
type Category = AdminFeedback['category'];

export const FEEDBACK_STATUS: Record<Status, { label: string; tone: Tone }> = {
  NEW: { label: 'New', tone: 'accent' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  DONE: { label: 'Done', tone: 'success' },
  WONT_FIX: { label: 'Won’t fix', tone: 'neutral' },
};
const STATUSES = Object.keys(FEEDBACK_STATUS) as Status[];

const CATEGORY: Record<Category, { label: string; tone: Tone; Icon: typeof Bug }> = {
  BUG: { label: 'Bug', tone: 'danger', Icon: Bug },
  IDEA: { label: 'Idea', tone: 'accent', Icon: Lightbulb },
  CONFUSING: { label: 'Confusing', tone: 'warning', Icon: HelpCircle },
  PRAISE: { label: 'Praise', tone: 'success', Icon: ThumbsUp },
  OTHER: { label: 'Other', tone: 'neutral', Icon: MoreHorizontal },
};
const SOURCE: Record<AdminFeedback['source'], { label: string; Icon: typeof Monitor }> = {
  WEB: { label: 'Website', Icon: Monitor },
  MOBILE: { label: 'Mobile app', Icon: Smartphone },
  ADMIN: { label: 'Admin portal', Icon: Monitor },
};

/** "Mozilla/5.0 (iPhone; …) … Safari/604.1" → "Safari · iOS". Full string stays in the tooltip. */
export function shortUserAgent(ua?: string | null): string | null {
  if (!ua) return null;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Windows/.test(ua) ? 'Windows' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /HeadlessChrome/.test(ua) ? 'Headless Chrome' : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari' : /okhttp|Expo|Dart|CFNetwork|ReactNative/i.test(ua) ? 'App' : '';
  const label = [browser, os].filter(Boolean).join(' · ');
  return label || (ua.length > 36 ? `${ua.slice(0, 36)}…` : ua);
}

const Stars: React.FC<{ value: number | null; size?: number }> = ({ value, size = 13 }) =>
  value ? (
    <span className="a-fb-stars" title={`${value} of 5`} aria-label={`Rated ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} className={n <= value ? 'is-on' : ''} aria-hidden />)}
    </span>
  ) : (
    <span className="a-small a-muted">No rating</span>
  );

const SummaryTile: React.FC<{ label: string; value: React.ReactNode; icon: React.ReactNode; hint?: React.ReactNode; active?: boolean; onClick?: () => void }> = ({ label, value, icon, hint, active, onClick }) => {
  const body = (
    <>
      <div className="a-kpi__top">
        <span className="a-kpi__label">{label}</span>
        <span className="a-kpi__icon" aria-hidden>{icon}</span>
      </div>
      <div className="a-kpi__value a-kpi__value--sm">{value}</div>
      {hint && <div className="a-kpi__delta">{hint}</div>}
    </>
  );
  return onClick
    ? <button type="button" className={`a-kpi a-fb-tile${active ? ' is-active' : ''}`} aria-pressed={active} onClick={onClick}>{body}</button>
    : <div className="a-kpi">{body}</div>;
};

/** Page path → link where possible (marketplace pages on the marketplace origin, admin pages in-app). */
const PageRef: React.FC<{ item: AdminFeedback }> = ({ item }) => {
  if (!item.page) return <span className="a-muted">—</span>;
  const text = <span className="a-mono a-ellipsis" style={{ maxWidth: 260 }}>{item.page}</span>;
  if (item.source === 'ADMIN' && item.page.startsWith('/')) return <Link to={item.page} className="a-link a-fb-page" title={item.page}>{text}</Link>;
  if (item.source === 'WEB' && MARKETPLACE_URL && item.page.startsWith('/')) {
    return (
      <a href={`${MARKETPLACE_URL}${item.page}`} target="_blank" rel="noreferrer" className="a-link a-fb-page" title={`Open ${item.page} on the marketplace`}>
        {text} <ExternalLink size={11} aria-hidden />
      </a>
    );
  }
  return <span className="a-fb-page" title={item.page}>{text}</span>;
};

const LONG = 280;

const FeedbackRow: React.FC<{ item: AdminFeedback; onPatch: (id: string, body: { status?: Status; staffNote?: string | null }) => Promise<boolean> }> = ({ item, onPatch }) => {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(item.staffNote ?? '');
  const [busy, setBusy] = useState<'status' | 'note' | null>(null);
  const cat = CATEGORY[item.category];
  const src = SOURCE[item.source];
  const long = item.message.length > LONG || item.message.split('\n').length > 4;
  const ua = shortUserAgent(item.userAgent);
  const noteId = `fb-note-${item.id}`;

  useEffect(() => { if (!editing) setNote(item.staffNote ?? ''); }, [item.staffNote, editing]);

  const changeStatus = async (status: Status) => {
    setBusy('status');
    await onPatch(item.id, { status });
    setBusy(null);
  };
  const saveNote = async () => {
    setBusy('note');
    const ok = await onPatch(item.id, { staffNote: note.trim() ? note.trim() : null });
    setBusy(null);
    if (ok) setEditing(false);
  };

  return (
    <li className={`a-fb-row${item.status === 'NEW' ? ' is-new' : ''}`}>
      <div className="a-fb-main">
        <div className="a-row" style={{ gap: 6 }}>
          <Pill tone={cat.tone} icon={<cat.Icon size={12} />}>{cat.label}</Pill>
          <span className="a-vchip" title={`Sent from the ${src.label.toLowerCase()}`}><src.Icon size={11} /> {src.label}</span>
          <Stars value={item.rating} />
          <span className="a-small a-muted" title={fmtDateTime(item.createdAt)}>· {timeAgo(item.createdAt)}</span>
        </div>

        <p className={`a-fb-msg${long && !expanded ? ' is-clamped' : ''}`} id={`fb-msg-${item.id}`}>{item.message}</p>
        {long && (
          <button type="button" className="a-fb-more" aria-expanded={expanded} aria-controls={`fb-msg-${item.id}`} onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show less' : 'Show full message'}
          </button>
        )}

        <dl className="a-fb-meta">
          <div><dt>Page</dt><dd><PageRef item={item} /></dd></div>
          <div><dt>Device</dt><dd title={item.userAgent ?? undefined}>{ua ?? <span className="a-muted">—</span>}</dd></div>
          <div><dt>Version</dt><dd className="a-mono">{item.appVersion ?? '—'}</dd></div>
          <div><dt>Submitted</dt><dd>{fmtDateTime(item.createdAt)}</dd></div>
        </dl>

        {editing ? (
          <div className="a-fb-noteedit">
            <label className="a-label" htmlFor={noteId}>Staff note <span className="a-muted" style={{ fontWeight: 500 }}>(only visible to staff)</span></label>
            <textarea id={noteId} className="a-textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); } }} placeholder="e.g. Reproduced on Safari, fix in next release" />
            <div className="a-row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button small variant="ghost" onClick={() => setEditing(false)} disabled={busy === 'note'}>Cancel</Button>
              <Button small variant="primary" onClick={saveNote} loading={busy === 'note'}>Save note</Button>
            </div>
          </div>
        ) : item.staffNote ? (
          <div className="a-note a-fb-note">
            <div className="a-note__head"><span className="a-row" style={{ gap: 6 }}><StickyNote size={13} /> Staff note</span>
              <button type="button" className="a-link a-small" onClick={() => setEditing(true)}>Edit</button>
            </div>
            <div className="a-note__body">{item.staffNote}</div>
          </div>
        ) : null}
      </div>

      <div className="a-fb-side">
        <div className="a-fb-user">
          {item.user ? (
            <>
              <div className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                <span className="a-avatar a-avatar--soft" style={{ width: 30, height: 30, fontSize: 11 }} aria-hidden>{initials(item.user.displayName)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="a-ellipsis" style={{ fontWeight: 600 }}>{item.user.displayName}</div>
                  <Link to={`/users/${item.user.id}`} className="a-chip a-chip--mono a-fb-code" title="Open user profile">{item.user.userCode}</Link>
                </div>
              </div>
              {item.contactOk ? (
                <div className="a-fb-contact">
                  <Pill tone="success">OK to contact</Pill>
                  {item.user.email && <a href={`mailto:${item.user.email}`} className="a-link a-small a-ellipsis"><Mail size={12} /> {item.user.email}</a>}
                  {item.user.phone && <a href={`tel:${item.user.phone}`} className="a-link a-small"><Phone size={12} /> {fmtPhone(item.user.phone)}</a>}
                </div>
              ) : (
                <div className="a-small a-muted" style={{ marginTop: 6 }}>Didn’t ask to be contacted</div>
              )}
            </>
          ) : (
            <div className="a-small a-muted">Not signed in (anonymous)</div>
          )}
        </div>

        <div>
          <label className="a-kv__label" htmlFor={`fb-status-${item.id}`}>Status</label>
          <select
            id={`fb-status-${item.id}`} className={`a-select a-fb-status a-fb-status--${FEEDBACK_STATUS[item.status].tone}`} value={item.status}
            disabled={busy === 'status'} onChange={(e) => void changeStatus(e.target.value as Status)}
          >
            {STATUSES.map((s) => <option key={s} value={s}>{FEEDBACK_STATUS[s].label}</option>)}
          </select>
        </div>
        {!editing && (
          <Button small variant="soft" icon={<StickyNote size={14} />} onClick={() => setEditing(true)}>{item.staffNote ? 'Edit note' : 'Add note'}</Button>
        )}
      </div>
    </li>
  );
};

/** Tells the shell to refresh the sidebar "new feedback" badge. */
export const notifyFeedbackChanged = () => window.dispatchEvent(new Event('adm:feedback-changed'));

export const FeedbackPage: React.FC = () => {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = usePageParam();
  const [data, setData] = useState<AdminFeedbackList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  const status = (params.get('status') ?? '') as Status | '';
  const source = params.get('source') ?? '';
  const category = params.get('category') ?? '';
  const search = params.get('search') ?? '';
  const query = qs({ status, source, category, search, page, limit: PAGE_SIZE });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<AdminFeedbackList>(`/admin/feedback${query}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) setData(res.data);
      else setError(apiError(res, 'Could not load feedback'));
    });
    return () => { cancelled = true; };
  }, [query, reload]);

  const setStatus = (s: Status | '') => setParams((p) => {
    const n = new URLSearchParams(p);
    if (s) n.set('status', s); else n.delete('status');
    n.delete('page');
    return n;
  });

  const patch = async (id: string, body: { status?: Status; staffNote?: string | null }) => {
    const res = await fetchApi<AdminFeedback>(`/admin/feedback/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.success || !res.data) {
      toast('danger', apiError(res, 'Could not update feedback'));
      return false;
    }
    const updated = res.data;
    setData((d) => d && { ...d, items: d.items.map((it) => (it.id === id ? { ...it, status: updated.status, staffNote: updated.staffNote } : it)) });
    toast('success', body.status ? `Marked as ${FEEDBACK_STATUS[body.status].label.toLowerCase()}` : body.staffNote ? 'Note saved' : 'Note removed');
    if (body.status) {
      notifyFeedbackChanged();
      setReload((n) => n + 1); // refresh counts (and drop the row if it no longer matches the status tab)
    }
    return true;
  };

  const summary = data?.summary;
  const count = (s: Status) => summary?.byStatus[s] ?? 0;
  const total = STATUSES.reduce((n, s) => n + count(s), 0);
  const hasFilters = !!(status || source || category || search);
  const items = data?.items ?? null;
  const pagination: PaginationT | null = data?.pagination ?? null;

  return (
    <div>
      <PageHeader
        overline="Closed beta"
        title="Beta feedback"
        subtitle="Bugs, ideas and reactions sent from the website, app and this portal. Triage them, leave a note for the team, and close the loop."
      />

      <div className="a-kpis a-fb-kpis" style={{ marginBottom: 20 }}>
        <SummaryTile label="New" value={summary ? fmtNum(count('NEW')) : '—'} icon={<Inbox size={16} />} hint="waiting for triage" active={status === 'NEW'} onClick={() => setStatus(status === 'NEW' ? '' : 'NEW')} />
        <SummaryTile label="In progress" value={summary ? fmtNum(count('IN_PROGRESS')) : '—'} icon={<Clock size={16} />} hint="being looked at" active={status === 'IN_PROGRESS'} onClick={() => setStatus(status === 'IN_PROGRESS' ? '' : 'IN_PROGRESS')} />
        <SummaryTile label="Done" value={summary ? fmtNum(count('DONE')) : '—'} icon={<CheckCircle2 size={16} />} hint="fixed or answered" active={status === 'DONE'} onClick={() => setStatus(status === 'DONE' ? '' : 'DONE')} />
        <SummaryTile label="Won’t fix" value={summary ? fmtNum(count('WONT_FIX')) : '—'} icon={<XCircle size={16} />} hint="closed without change" active={status === 'WONT_FIX'} onClick={() => setStatus(status === 'WONT_FIX' ? '' : 'WONT_FIX')} />
        <SummaryTile
          label="Average rating"
          value={summary?.averageRating != null ? <span className="a-row" style={{ gap: 6 }}>{summary.averageRating.toFixed(1)} <Star size={20} fill="currentColor" className="a-fb-star-lg" aria-hidden /></span> : '—'}
          icon={<Star size={16} />}
          hint={summary ? `from ${fmtNum(summary.ratedCount)} rating${summary.ratedCount === 1 ? '' : 's'}` : undefined}
        />
      </div>

      <div className="a-stack" style={{ gap: 16 }}>
        <div className="a-tabs a-tabs--status" role="tablist" aria-label="Feedback status">
          {(['', ...STATUSES] as (Status | '')[]).map((s) => (
            <button key={s || 'all'} role="tab" aria-selected={status === s} className="a-tab" onClick={() => setStatus(s)}>
              {s && <span className={`a-dot a-dot--${FEEDBACK_STATUS[s].tone}`} aria-hidden />}
              {s ? FEEDBACK_STATUS[s].label : 'All feedback'}
              {summary && <span className="a-tab__count">{fmtNum(s ? count(s) : total)}</span>}
            </button>
          ))}
        </div>

        <Card>
          <div className="a-toolbar">
            <SearchBox label="Search feedback" placeholder="Search message text" width={320} />
            <ParamSelect name="source" label="Source" allLabel="Source: all" options={[['WEB', 'Website'], ['MOBILE', 'Mobile app'], ['ADMIN', 'Admin portal']]} />
            <ParamSelect name="category" label="Category" allLabel="Category: all" options={(Object.keys(CATEGORY) as Category[]).map((c) => [c, CATEGORY[c].label])} />
            {hasFilters && <Button variant="ghost" small icon={<X size={14} />} onClick={() => setParams({})}>Clear filters</Button>}
          </div>
        </Card>

        {error && <ErrorBanner message={error} onRetry={() => setReload((n) => n + 1)} />}

        <Card flush>
          {!items && loading ? (
            <Loading />
          ) : items && items.length === 0 ? (
            <EmptyState icon={<Inbox size={30} />} title={hasFilters ? 'No feedback matches' : 'No feedback yet'}>
              {hasFilters ? 'Try another status, source or search.' : 'When beta testers use “Send feedback”, it shows up here.'}
            </EmptyState>
          ) : (
            <ul className="a-fb-list" style={{ opacity: loading ? 0.6 : 1 }} aria-busy={loading}>
              {items?.map((it) => <FeedbackRow key={it.id} item={it} onPatch={patch} />)}
            </ul>
          )}
          <Pagination pagination={pagination} onPage={setPage} noun="items" />
        </Card>
      </div>
    </div>
  );
};
