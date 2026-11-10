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

export const LISTING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#9ca3af' },
  PENDING_REVIEW: { label: 'In review', color: '#f59e0b' },
  LIVE: { label: 'Live', color: '#10b981' },
  RESERVED: { label: 'Reserved', color: '#818cf8' },
  SOLD: { label: 'Sold', color: '#06b6d4' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  SUSPENDED: { label: 'Suspended', color: '#ef4444' },
  EXPIRED: { label: 'Expired', color: '#6b7280' },
};
