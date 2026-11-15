import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ApiResponse } from '../api/client';
import type { Pagination as PaginationT } from './types';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const monthYearFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const numFmt = new Intl.NumberFormat('en-IN');

export const fmtDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const fmtMonthYear = (iso?: string | null) => (iso ? monthYearFmt.format(new Date(iso)) : '—');
export const fmtDateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const fmtNum = (n?: number | null) => (n == null ? '—' : numFmt.format(n));

export function timeAgo(iso?: string | null): string {
  if (!iso) return 'Never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return fmtDate(iso);
}

/** Compact age without "ago": "12m", "5h", "3d". */
export function ageShort(iso?: string | null): string {
  if (!iso) return '—';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

/** "+919876543210" → "+91 98765 43210". */
export function fmtPhone(p?: string | null): string {
  if (!p) return '—';
  const m = /^\+91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

/** Builds a query string from defined, non-empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Friendlier wording for API error codes staff are likely to hit. */
const ERROR_COPY: Record<string, string> = {
  STAFF_ACCOUNT: 'Staff accounts can’t be suspended or banned from here.',
  CANNOT_CHANGE_SELF: 'You can’t change the status of your own account.',
  FORBIDDEN: 'Your role doesn’t allow this action. Ask an admin.',
  INSUFFICIENT_PERMISSIONS: 'Your role doesn’t allow this action. Ask an admin.',
  INVALID_LISTING_STATE: '',
  NETWORK_ERROR: 'Could not reach the Becho API. Check your connection.',
};

export function apiError(res: ApiResponse<unknown>, fallback = 'Something went wrong'): string {
  const code = res.error?.code;
  const friendly = code ? ERROR_COPY[code] : undefined;
  if (friendly) return friendly;
  const detail = res.error?.details?.[0]?.message;
  return detail || res.error?.message || fallback;
}

/** Tells the shell to refresh the review-queue badge after a moderation action. */
export const notifyQueueChanged = () => window.dispatchEvent(new Event('adm:queue-changed'));

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'info' | 'neutral';

/** Readable text colour for a tone (used for icons/inline text outside chips). */
export const toneText = (tone: Tone) =>
  ({
    success: 'var(--a-success-text)',
    warning: 'var(--a-warning-text)',
    danger: 'var(--a-danger-text)',
    accent: 'var(--a-primary-text)',
    info: 'var(--a-info-text)',
    neutral: 'var(--a-text-2)',
  })[tone];

export const Pill: React.FC<{ tone: Tone; children: React.ReactNode; icon?: React.ReactNode; title?: string; round?: boolean; className?: string }> = ({
  tone, children, icon, title, round, className = '',
}) => (
  <span title={title} className={`a-chip a-chip--${tone}${round ? ' a-chip--pill' : ''} ${className}`}>
    {icon}
    {children}
  </span>
);

const USER_STATUS: Record<string, [string, Tone]> = {
  ACTIVE: ['Active', 'success'],
  PENDING_VERIFICATION: ['Unverified', 'warning'],
  SUSPENDED: ['Suspended', 'danger'],
  BANNED: ['Banned', 'danger'],
};

export const LISTING_STATUS: Record<string, [string, Tone]> = {
  DRAFT: ['Draft', 'neutral'],
  SUBMITTED: ['Submitted', 'warning'],
  PENDING_REVIEW: ['In review', 'warning'],
  APPROVED: ['Approved', 'info'],
  LIVE: ['Live', 'success'],
  RESERVED: ['Reserved', 'accent'],
  SOLD: ['Sold', 'info'],
  REJECTED: ['Rejected', 'danger'],
  CHANGES_REQUESTED: ['Changes requested', 'warning'],
  SUSPENDED: ['Suspended', 'danger'],
  EXPIRED: ['Expired', 'neutral'],
  ARCHIVED: ['Archived', 'neutral'],
  DELETED: ['Deleted', 'neutral'],
};

export const UserStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const [label, tone] = USER_STATUS[status] ?? [humanize(status), 'neutral' as Tone];
  return <Pill tone={tone} round icon={<span className="a-dot" />}>{label}</Pill>;
};

export const ListingStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const [label, tone] = LISTING_STATUS[status] ?? [humanize(status), 'neutral' as Tone];
  return <Pill tone={tone} round icon={<span className="a-dot" />}>{label}</Pill>;
};

export const VerifiedBadge: React.FC<{ small?: boolean }> = ({ small }) => (
  <Pill tone="success" icon={<CheckCircle2 size={small ? 11 : 13} />} title="Verified by Becho staff">Verified</Pill>
);

/** "✓ Verified" / "Not verified" inline status for an email or mobile. */
export const CheckMark: React.FC<{ ok: boolean; okLabel?: string; noLabel?: string; title?: string }> = ({ ok, okLabel = 'Verified', noLabel = 'Not verified', title }) => (
  <span className={`a-check ${ok ? 'a-check--ok' : 'a-check--no'}`} title={title}>
    {ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />} {ok ? okLabel : noLabel}
  </span>
);

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'ink' | 'secondary' | 'soft' | 'danger' | 'danger-solid' | 'success' | 'ghost';

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: React.ReactNode; small?: boolean; large?: boolean; block?: boolean; loading?: boolean }
> = ({ variant = 'secondary', icon, small, large, block, loading, children, className = '', disabled, type = 'button', ...rest }) => (
  <button
    type={type}
    className={`a-btn a-btn--${variant}${small ? ' a-btn--sm' : ''}${large ? ' a-btn--lg' : ''}${block ? ' a-btn--block' : ''} ${className}`}
    disabled={disabled || loading}
    {...rest}
  >
    {loading ? <Loader2 size={small ? 13 : 15} className="a-spin" /> : icon}
    {children}
  </button>
);

export const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable (http / permissions) — still show state */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`${label} ${value}`}
      title={copied ? 'Copied' : `${label} ${value}`}
      style={{ display: 'inline-flex', alignItems: 'center', padding: 3, borderRadius: 5, color: copied ? 'var(--a-success-text)' : 'var(--a-muted)' }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Containers & states                                                 */
/* ------------------------------------------------------------------ */

export const Card: React.FC<{
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  flush?: boolean;
  small?: boolean;
  id?: string;
}> = ({ title, subtitle, actions, children, className = '', style, flush, small, id }) => (
  <section id={id} className={`a-card${flush ? ' a-card--flush' : ''} ${className}`} style={style}>
    {(title || actions) && (
      <div className="a-card__head" style={flush ? { padding: '20px 20px 0' } : undefined}>
        <div style={{ minWidth: 0 }}>
          {title && <h2 className={`a-card__title${small ? ' a-card__title--sm' : ''}`}>{title}</h2>}
          {subtitle && <div className="a-card__sub">{subtitle}</div>}
        </div>
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const PageHeader: React.FC<{
  overline?: React.ReactNode;
  meta?: React.ReactNode;
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ overline, meta, title, titleExtra, subtitle, actions }) => (
  <header className="a-pagehead">
    <div style={{ minWidth: 0 }}>
      {overline && (
        <div className="a-overline">
          <span className="a-overline__dot" aria-hidden /> {overline}
          {meta && <span className="a-overline__meta">· {meta}</span>}
        </div>
      )}
      <div className="a-h1-row">
        <h1 className="a-h1">{title}</h1>
        {titleExtra}
      </div>
      {subtitle && <div className="a-pagehead__sub">{subtitle}</div>}
    </div>
    {actions}
  </header>
);

export const BackLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link to={to} className="a-back">
    <ArrowLeft size={15} /> {label}
  </Link>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" className="a-banner a-banner--danger" style={{ alignItems: 'center' }}>
    <AlertCircle size={17} />
    <span style={{ flex: 1 }}>{message}</span>
    {onRetry && <Button small onClick={onRetry}>Retry</Button>}
  </div>
);

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="a-loading" role="status">
    <Loader2 size={18} className="a-spin" /> {label}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="a-empty">
    {icon && <div className="a-empty__icon">{icon}</div>}
    <div className="a-empty__title">{title}</div>
    {children && <div style={{ fontSize: 13 }}>{children}</div>}
  </div>
);

/** Table footer: "Showing 1–25 of 140 users" + pager. */
export const Pagination: React.FC<{ pagination: PaginationT | null; onPage: (p: number) => void; noun: string }> = ({ pagination, onPage, noun }) => {
  if (!pagination) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = Math.max(totalPages, 1);
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages])).filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  return (
    <div className="a-table-foot">
      <span>{total === 0 ? `No ${noun}` : <>Showing <strong style={{ color: 'var(--a-text)' }}>{fmtNum(from)}–{fmtNum(to)}</strong> of {fmtNum(total)} {noun}</>}</span>
      {pages > 1 && (
        <nav className="a-pager" aria-label="Pagination">
          <button disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
          {nums.map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && p - nums[i - 1] > 1 && <span className="a-muted" aria-hidden>…</span>}
              {p === page ? <span className="a-pager__cur" aria-current="page">{p}</span> : <button onClick={() => onPage(p)} aria-label={`Page ${p}`}>{p}</button>}
            </React.Fragment>
          ))}
          <button disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
        </nav>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number }> = ({ title, onClose, children, footer, width = 480 }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('textarea, input, select, button:not([data-close])');
    first?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="a-modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="a-modal" style={{ maxWidth: width }}>
        <div className="a-modal__head">
          <h2 className="a-modal__title">{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="a-iconbtn" style={{ width: 30, height: 30 }}>
            <X size={17} />
          </button>
        </div>
        <div className="a-modal__body">{children}</div>
        {footer && <div className="a-modal__foot">{footer}</div>}
      </div>
    </div>
  );
};

/** A modal that collects a required (or optional) text reason before confirming an action. */
export const ReasonDialog: React.FC<{
  title: string;
  description?: React.ReactNode;
  label: string;
  confirmLabel: string;
  variant?: BtnVariant;
  minLength?: number; // 0 = optional
  placeholder?: string;
  extra?: (state: { checked: boolean; setChecked: (v: boolean) => void }) => React.ReactNode;
  defaultChecked?: boolean;
  initialText?: string;
  onConfirm: (text: string, checked: boolean) => Promise<string | null>; // returns error message or null
  onClose: () => void;
}> = ({ title, description, label, confirmLabel, variant = 'primary', minLength = 5, placeholder, extra, defaultChecked = true, initialText = '', onConfirm, onClose }) => {
  const [text, setText] = useState(initialText);
  const [checked, setChecked] = useState(defaultChecked);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = text.trim();
  const invalid = minLength > 0 && trimmed.length < minLength;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    setError(null);
    const err = await onConfirm(trimmed, checked);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={variant} onClick={() => submit()} loading={busy}>{confirmLabel}</Button>
        </>
      }
    >
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {description && <div style={{ fontSize: 13.5, color: 'var(--a-text-2)' }}>{description}</div>}
        {error && <ErrorBanner message={error} />}
        <div>
          <label className="a-label" htmlFor="reason-text">
            {label}
            {minLength > 0 ? <span className="a-label__req"> *</span> : <span className="a-muted" style={{ fontWeight: 500 }}> (optional)</span>}
          </label>
          <textarea
            id="reason-text"
            rows={4}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && invalid}
            className="a-textarea"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
            <span style={{ color: 'var(--a-danger-text)' }}>{touched && invalid ? `Please enter at least ${minLength} characters.` : ''}</span>
            <span className="a-muted">{trimmed.length} chars</span>
          </div>
        </div>
        {extra?.({ checked, setChecked })}
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

interface Toast { id: number; tone: 'success' | 'danger'; text: string }
const ToastContext = createContext<(tone: Toast['tone'], text: string) => void>(() => {});

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'danger' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="a-toasts">
        {toasts.map((t) => (
          <div key={t.id} role={t.tone === 'danger' ? 'alert' : 'status'} className={`a-toast a-toast--${t.tone}`}>
            {t.tone === 'success' ? <CheckCircle2 size={18} color="var(--a-success)" /> : <AlertCircle size={18} color="var(--a-danger)" />}
            <span style={{ flex: 1 }}>{t.text}</span>
            <button aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} style={{ color: 'var(--a-muted)', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Small layout helpers                                                */
/* ------------------------------------------------------------------ */

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ minWidth: 0 }}>
    <div className="a-kv__label">{label}</div>
    <div className="a-kv__value">{children}</div>
  </div>
);

export const Mini: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode }> = ({ label, value, hint }) => (
  <div className="a-mini">
    <div className="a-mini__label">{label}</div>
    <div className="a-mini__value">{value}</div>
    {hint && <div className="a-mini__hint">{hint}</div>}
  </div>
);

export const Thumb: React.FC<{ url?: string; mediaType?: string; size?: number; alt?: string; tag?: React.ReactNode }> = ({ url, mediaType, size = 44, alt = '', tag }) => (
  <div className="a-thumb" style={{ width: size, height: size }}>
    {url ? (
      mediaType === 'VIDEO' ? <video src={url} muted preload="metadata" /> : <img src={url} alt={alt} loading="lazy" />
    ) : (
      'No photo'
    )}
    {tag && <span className="a-thumb__tag">{tag}</span>}
  </div>
);
