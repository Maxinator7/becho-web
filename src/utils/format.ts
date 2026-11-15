const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** Formats an amount as Indian Rupees with Indian digit grouping, e.g. ₹5,25,000. */
export const formatPrice = (amount: number, currency = 'INR') =>
  currency === 'INR'
    ? inr.format(amount)
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  USED: 'Used',
  REFURBISHED: 'Refurbished',
  FOR_PARTS: 'For parts',
};

/** Status chips. Colours are theme tokens so text stays readable in light and dark mode. */
export const LISTING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'var(--text-secondary)' },
  PENDING_REVIEW: { label: 'Under review', color: 'var(--warning)' },
  LIVE: { label: 'Live', color: 'var(--success)' },
  RESERVED: { label: 'Reserved', color: 'var(--accent-primary)' },
  SOLD: { label: 'Sold', color: 'var(--accent-secondary)' },
  CHANGES_REQUESTED: { label: 'Changes requested', color: 'var(--warning)' },
  REJECTED: { label: 'Rejected', color: 'var(--danger)' },
  SUSPENDED: { label: 'Suspended', color: 'var(--danger)' },
  EXPIRED: { label: 'Expired', color: 'var(--text-muted)' },
};

export type StatusTone = 'success' | 'warning' | 'danger' | 'primary' | 'neutral';

/** Tone of each listing status chip (see .chip-* in index.css). */
export const LISTING_STATUS_TONES: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  LIVE: 'success',
  RESERVED: 'primary',
  SOLD: 'neutral',
  CHANGES_REQUESTED: 'danger',
  REJECTED: 'danger',
  SUSPENDED: 'danger',
  EXPIRED: 'neutral',
};

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Compact rupees for stat tiles: ₹950, ₹12.5K, ₹3.4L, ₹1.2Cr. */
export function formatCompactINR(amount: number) {
  const n = Math.round(amount);
  const trim = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ''));
  if (n >= 1_00_00_000) return `₹${trim(n / 1_00_00_000)}Cr`;
  if (n >= 1_00_000) return `₹${trim(n / 1_00_000)}L`;
  if (n >= 1_000) return `₹${trim(n / 1_000)}K`;
  return `₹${n}`;
}

/** Statuses a seller can still edit and resubmit. */
export const EDITABLE_LISTING_STATUSES = ['DRAFT', 'REJECTED', 'CHANGES_REQUESTED'];

/** Labels for staff review actions shown to sellers. */
export const REVIEW_ACTION_LABELS: Record<string, string> = {
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
  VERIFIED: 'Verified',
  CHANGES_REQUESTED: 'Changes requested',
  REMARK: 'Note from Becho',
};
