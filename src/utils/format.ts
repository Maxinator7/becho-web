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
  PENDING_REVIEW: { label: 'In review', color: 'var(--warning)' },
  LIVE: { label: 'Live', color: 'var(--success)' },
  RESERVED: { label: 'Reserved', color: 'var(--accent-primary)' },
  SOLD: { label: 'Sold', color: 'var(--accent-secondary)' },
  CHANGES_REQUESTED: { label: 'Changes requested', color: 'var(--warning)' },
  REJECTED: { label: 'Rejected', color: 'var(--danger)' },
  SUSPENDED: { label: 'Suspended', color: 'var(--danger)' },
  EXPIRED: { label: 'Expired', color: 'var(--text-muted)' },
};

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
