/**
 * Client-side validation that mirrors the API rules (becho-api auth.schema.ts), so most
 * mistakes are caught before a request. The server stays authoritative: its per-field
 * messages (`error.details[].path`) are mapped back onto fields with `fieldErrorsFrom`.
 */
import type { ApiResponse } from '../api/client';

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

/** Returns the 10-digit Indian mobile (6–9 start) or null. Accepts +91 / 91 / 0 prefixes, spaces, dashes. */
export function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** "+919876543210" → "+91 98765 43210". Falls back to the input when it isn't an Indian mobile. */
export function formatIndianMobile(raw?: string | null): string {
  if (!raw) return '';
  const local = normalizeIndianMobile(raw);
  return local ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : raw;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const USER_CODE_RE = /^BCH-[0-9A-Z]{6}$/;
const NAME_RE = /^[\p{L}\p{M} .'-]+$/u;

export function validateEmail(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return 'Enter your email address';
  if (v.length > 254 || !EMAIL_RE.test(v)) return 'Enter a valid email address';
  return undefined;
}

export function validateMobile(raw: string): string | undefined {
  if (!raw.trim()) return 'Enter your mobile number';
  if (!normalizeIndianMobile(raw)) return 'Enter a valid 10-digit Indian mobile number';
  return undefined;
}

export function validateName(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return 'Enter your name';
  if (v.length < 2) return 'Name must be at least 2 characters';
  if (v.length > 60) return 'Name must be at most 60 characters';
  if (!NAME_RE.test(v)) return 'Name can only contain letters, spaces, dots, apostrophes and hyphens';
  return undefined;
}

export const PASSWORD_RULES: { id: string; label: string; test: (p: string) => boolean }[] = [
  { id: 'length', label: '8 to 128 characters', test: (p) => p.length >= 8 && p.length <= 128 },
  { id: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

export function validatePassword(p: string): string | undefined {
  if (!p) return 'Enter a password';
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 128) return 'Password must be at most 128 characters';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain at least one letter and one number';
  return undefined;
}

export function validateConfirm(password: string, confirm: string): string | undefined {
  if (!confirm) return 'Re-enter your password';
  if (password !== confirm) return 'Passwords do not match';
  return undefined;
}

export type IdentifierKind = 'email' | 'phone' | 'userCode';

/** Classifies what the user typed in an "email, mobile or user code" field. */
export function parseIdentifier(raw: string): { kind: IdentifierKind; value: string } | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes('@')) return validateEmail(v) ? null : { kind: 'email', value: v.toLowerCase() };
  const code = v.toUpperCase();
  if (USER_CODE_RE.test(code)) return { kind: 'userCode', value: code };
  const mobile = normalizeIndianMobile(v);
  return mobile ? { kind: 'phone', value: mobile } : null;
}

export function validateIdentifier(raw: string): string | undefined {
  const v = raw.trim();
  if (!v) return 'Enter your email, mobile number or user code';
  if (v.includes('@')) return validateEmail(v);
  if (!parseIdentifier(v)) return 'Enter a valid email, 10-digit mobile number or user code (BCH-XXXXXX)';
  return undefined;
}

export function validateOtp(code: string): string | undefined {
  if (!code) return 'Enter the 6-digit code';
  if (!/^\d{6}$/.test(code)) return 'The code is 6 digits';
  return undefined;
}

/**
 * Maps API validation details onto form fields. `aliases` renames API paths to form field
 * names (e.g. { displayName: 'name' }). Unknown paths are ignored.
 */
export function fieldErrorsFrom<K extends string>(
  res: ApiResponse<unknown>,
  fields: readonly K[],
  aliases: Record<string, K> = {},
): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const d of res.error?.details ?? []) {
    const key = (aliases[d.path] ?? d.path) as K;
    if (fields.includes(key) && !out[key]) out[key] = d.message;
  }
  return out;
}

/** True when there is at least one error message. */
export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean);

/** Focuses the first field (in `order`) that has an error. Fields are looked up by element id. */
export function focusFirstError(errors: FieldErrors, order: readonly string[], idPrefix = '') {
  const first = order.find((k) => errors[k]);
  if (first) document.getElementById(idPrefix + first)?.focus();
}
