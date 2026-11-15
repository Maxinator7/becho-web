import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ChevronLeft, ChevronRight, Copy, Loader2, X } from 'lucide-react';
import type { ApiResponse } from '../api/client';
import type { Pagination as PaginationT } from './types';

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const numFmt = new Intl.NumberFormat('en-IN');

export const fmtDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—');
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

/** "+919876543210" → "+91 98765 43210". */
export function fmtPhone(p?: string | null): string {
  if (!p) return '—';
  const m = /^\+91(\d{5})(\d{5})$/.exec(p);
  return m ? `+91 ${m[1]} ${m[2]}` : p;
}

export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

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
/* Styles                                                              */
/* ------------------------------------------------------------------ */

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--input-text)',
  fontSize: '0.9rem',
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  width: 'auto',
  background: 'var(--select-bg)',
  paddingRight: '0.5rem',
  cursor: 'pointer',
};

export const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' };

export const mutedText: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: '0.85rem' };

/* ------------------------------------------------------------------ */
/* Pills & badges                                                      */
/* ------------------------------------------------------------------ */

export type Tone = 'success' | 'warning' | 'danger' | 'accent' | 'info' | 'neutral';

const TONE_VAR: Record<Tone, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  accent: 'var(--accent-primary)',
  info: 'var(--accent-secondary)',
  neutral: 'var(--text-muted)',
};

/** Text tinted toward the theme's primary ink so it stays readable on the soft fill in both themes. */
export const toneText = (tone: Tone) =>
  tone === 'neutral' ? 'var(--text-secondary)' : `color-mix(in srgb, ${TONE_VAR[tone]} 78%, var(--text-primary))`;

export const Pill: React.FC<{ tone: Tone; children: React.ReactNode; icon?: React.ReactNode; title?: string }> = ({ tone, children, icon, title }) => (
  <span
    title={title}
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.15rem 0.6rem', borderRadius: '999px',
      fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.5,
      background: `color-mix(in srgb, ${TONE_VAR[tone]} 14%, transparent)`,
      border: `1px solid color-mix(in srgb, ${TONE_VAR[tone]} 30%, transparent)`,
      color: toneText(tone),
    }}
  >
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
  return <Pill tone={tone}>{label}</Pill>;
};

export const ListingStatusPill: React.FC<{ status: string }> = ({ status }) => {
  const [label, tone] = LISTING_STATUS[status] ?? [humanize(status), 'neutral' as Tone];
  return <Pill tone={tone}>{label}</Pill>;
};

export const VerifiedBadge: React.FC<{ small?: boolean }> = ({ small }) => (
  <Pill tone="info" icon={<CheckCircle2 size={small ? 11 : 13} />} title="Verified by Becho staff">Verified</Pill>
);

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: React.ReactNode; small?: boolean; loading?: boolean }> = ({
  variant = 'secondary', icon, small, loading, children, style, disabled, ...rest
}) => {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: small ? '0.35rem 0.7rem' : '0.55rem 1rem', fontSize: small ? '0.8rem' : '0.875rem',
    fontWeight: 600, borderRadius: '8px', whiteSpace: 'nowrap', border: '1px solid transparent',
    transition: 'filter 0.15s ease',
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: { background: 'var(--accent-primary)', color: 'var(--text-on-accent)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text-primary)', borderColor: 'var(--border-strong)' },
    danger: { background: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: toneText('danger'), borderColor: 'color-mix(in srgb, var(--danger) 40%, transparent)' },
    success: { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: toneText('success'), borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)' },
    ghost: { background: 'transparent', color: 'var(--text-secondary)' },
  };
  return (
    <button className="adm-btn" disabled={disabled || loading} style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {loading ? <Loader2 size={small ? 13 : 15} style={{ animation: 'becho-spin 1s linear infinite' }} /> : icon}
      {children}
    </button>
  );
};

export const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable (http / permissions) — fall through to show state anyway */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="adm-btn"
      aria-label={`${label} ${value}`}
      title={copied ? 'Copied' : `${label} ${value}`}
      style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem', borderRadius: '6px', color: copied ? toneText('success') : 'var(--text-muted)' }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Containers & states                                                 */
/* ------------------------------------------------------------------ */

export const Card: React.FC<{ title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties; padding?: string }> = ({ title, actions, children, style, padding = '1.25rem' }) => (
  <section className="glass-panel" style={{ padding, ...style }}>
    {(title || actions) && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {title && <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{title}</h2>}
        {actions}
      </div>
    )}
    {children}
  </section>
);

export const PageHeader: React.FC<{ title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }> = ({ title, subtitle, actions, back }) => (
  <header style={{ marginBottom: '1.5rem' }}>
    {back}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.25 }}>{title}</h1>
        {subtitle && <div style={{ ...mutedText, marginTop: '0.25rem' }}>{subtitle}</div>}
      </div>
      {actions}
    </div>
  </header>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div role="alert" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', color: toneText('danger'), background: 'color-mix(in srgb, var(--danger) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', padding: '0.7rem 0.9rem', borderRadius: '8px', fontSize: '0.875rem' }}>
    <AlertCircle size={17} style={{ flexShrink: 0 }} />
    <span style={{ flex: 1 }}>{message}</span>
    {onRetry && <Button small onClick={onRetry}>Retry</Button>}
  </div>
);

export const Loading: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '3rem 1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
    <Loader2 size={18} style={{ animation: 'becho-spin 1s linear infinite' }} /> {label}
  </div>
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode }> = ({ icon, title, children }) => (
  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
    {icon && <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>{icon}</div>}
    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{title}</div>
    {children && <div style={{ fontSize: '0.85rem' }}>{children}</div>}
  </div>
);

export const Pagination: React.FC<{ pagination: PaginationT | null; onPage: (p: number) => void; noun: string }> = ({ pagination, onPage, noun }) => {
  if (!pagination) return null;
  const { page, totalPages, total, limit } = pagination;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.85rem 0.25rem 0', flexWrap: 'wrap' }}>
      <span style={mutedText}>
        {total === 0 ? `No ${noun}` : `${fmtNum(from)}–${fmtNum(to)} of ${fmtNum(total)} ${noun}`}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Button small icon={<ChevronLeft size={14} />} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">Prev</Button>
        <span style={{ ...mutedText, minWidth: '5.5rem', textAlign: 'center' }}>Page {page} of {Math.max(totalPages, 1)}</span>
        <Button small disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">Next <ChevronRight size={14} /></Button>
      </div>
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
    <div
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: '100%', maxWidth: width, background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', borderRadius: '14px', boxShadow: 'var(--shadow)', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{title}</h2>
          <button data-close onClick={onClose} aria-label="Close" className="adm-btn" style={{ color: 'var(--text-secondary)', display: 'flex', padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '1.25rem' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', padding: '0 1.25rem 1.25rem' }}>{footer}</div>}
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
  onConfirm: (text: string, checked: boolean) => Promise<string | null>; // returns error message or null
  onClose: () => void;
}> = ({ title, description, label, confirmLabel, variant = 'primary', minLength = 5, placeholder, extra, defaultChecked = true, onConfirm, onClose }) => {
  const [text, setText] = useState('');
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
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
        {description && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{description}</div>}
        {error && <ErrorBanner message={error} />}
        <div>
          <label style={labelStyle} htmlFor="reason-text">
            {label}{minLength > 0 ? ' *' : ' (optional)'}
          </label>
          <textarea
            id="reason-text"
            rows={4}
            value={text}
            placeholder={placeholder}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && invalid}
            style={{ ...inputStyle, resize: 'vertical', borderColor: touched && invalid ? 'var(--danger)' : undefined }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            <span style={{ color: toneText('danger') }}>{touched && invalid ? `Please enter at least ${minLength} characters.` : ''}</span>
            <span style={{ color: 'var(--text-muted)' }}>{trimmed.length} chars</span>
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
      <div aria-live="polite" style={{ position: 'fixed', bottom: '1.25rem', right: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 200, maxWidth: 'min(420px, calc(100vw - 2.5rem))' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'danger' ? 'alert' : 'status'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '10px',
              background: 'var(--bg-secondary)', border: `1px solid color-mix(in srgb, ${TONE_VAR[t.tone]} 45%, var(--border-strong))`,
              boxShadow: 'var(--shadow)', fontSize: '0.875rem', animation: 'adm-toast-in 0.18s ease-out',
            }}
          >
            {t.tone === 'success' ? <CheckCircle2 size={18} color={TONE_VAR.success} /> : <AlertCircle size={18} color={TONE_VAR.danger} />}
            <span style={{ flex: 1 }}>{t.text}</span>
            <button className="adm-btn" aria-label="Dismiss" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} style={{ color: 'var(--text-muted)', display: 'flex' }}>
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
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
    <div style={{ fontSize: '0.9rem', marginTop: '0.15rem', overflowWrap: 'anywhere' }}>{children}</div>
  </div>
);

export const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }> = ({ label, value, hint, icon }) => (
  <div className="glass-panel" style={{ padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
      {icon}
      {label}
    </div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.2 }}>{value}</div>
    {hint && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hint}</div>}
  </div>
);

export const Thumb: React.FC<{ url?: string; mediaType?: string; size?: number; alt?: string }> = ({ url, mediaType, size = 44, alt = '' }) => (
  <div style={{ width: size, height: size, borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-3)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
    {url ? (
      mediaType === 'VIDEO' ? (
        <video src={url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <img src={url} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )
    ) : (
      'No photo'
    )}
  </div>
);
