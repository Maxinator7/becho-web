/** Friendly wording for automated-check (sanitization) output. */

export const REASON_LABELS: Record<string, string> = {
  PROHIBITED_CONTENT: 'Prohibited terms found',
  SUSPICIOUS_PRICING: 'Unusual price',
  MISSING_REQUIRED_INFORMATION: 'Description too short',
};

export const CHECK_LABELS: Record<string, string> = {
  keywordCheck: 'Prohibited-terms scan',
  priceSanityCheck: 'Price sanity',
  descriptionCheck: 'Description length',
};

export const reasonLabel = (r: string) => REASON_LABELS[r] ?? r.charAt(0) + r.slice(1).toLowerCase().replace(/_/g, ' ');

export const checkLabel = (k: string) =>
  CHECK_LABELS[k] ?? k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());

/** Splits a check value like "FLAGGED (Unusual price: ₹10)" into pass/fail + detail. */
export function parseCheck(v: unknown): { passed: boolean | null; detail: string } {
  const s = typeof v === 'string' ? v : typeof v === 'boolean' ? (v ? 'PASSED' : 'FLAGGED') : JSON.stringify(v);
  if (/^pass/i.test(s)) return { passed: true, detail: s.replace(/^PASSED\s*/i, '').replace(/^\((.*)\)$/, '$1') };
  if (/^flag|^fail/i.test(s)) return { passed: false, detail: s.replace(/^(FLAGGED|FAILED)\s*/i, '').replace(/^\((.*)\)$/, '$1') };
  return { passed: null, detail: s };
}

export const scoreTone = (score: number) => (score >= 0.9 ? 'success' : score >= 0.5 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger';
