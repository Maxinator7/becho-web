import { fetchApi, type ApiResponse } from '../api/client';

/* Closed-beta feedback: shared by the marketplace and the admin portal. API: POST /feedback. */

export type FeedbackSource = 'WEB' | 'MOBILE' | 'ADMIN';
export type FeedbackCategory = 'BUG' | 'IDEA' | 'CONFUSING' | 'PRAISE' | 'OTHER';
export type FeedbackStatus = 'NEW' | 'IN_PROGRESS' | 'DONE' | 'WONT_FIX';

export const FEEDBACK_CATEGORIES: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: 'BUG', label: 'Bug', hint: 'What were you doing, what happened, and what did you expect?' },
  { value: 'IDEA', label: 'Idea', hint: 'What would make Becho better for you?' },
  { value: 'CONFUSING', label: 'Confusing', hint: 'Which part was unclear, and what did you expect instead?' },
  { value: 'PRAISE', label: 'Praise', hint: 'What do you like? We’d love to hear it.' },
  { value: 'OTHER', label: 'Other', hint: 'Tell us anything — including account deletion requests.' },
];

export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 2000;

/** package.json version, injected at build time. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

export interface FeedbackInput {
  source: FeedbackSource;
  category: FeedbackCategory;
  rating?: number;
  message: string;
  page?: string;
  appVersion?: string;
  contactOk?: boolean;
}

/** Sends feedback. The bearer token (if signed in) is attached by fetchApi. */
export function submitFeedback(input: FeedbackInput): Promise<ApiResponse<{ id: string; createdAt: string; message: string }>> {
  return fetchApi('/feedback', { method: 'POST', body: JSON.stringify(input) });
}

/** Human-readable error for a failed submission. */
export function feedbackError(res: ApiResponse<unknown>): string {
  const code = res.error?.code;
  if (code === 'RATE_LIMITED') return res.error?.message || 'You have sent a lot of feedback this hour — please try again later.';
  if (code === 'NETWORK_ERROR') return 'Could not reach Becho. Check your connection and try again.';
  return res.error?.details?.[0]?.message || res.error?.message || 'Could not send your feedback. Please try again.';
}

/* ── beta banner dismissal (per browser session) ── */

const BANNER_KEY = 'becho.betaBannerDismissed';

export function readBannerDismissed(): boolean {
  try { return sessionStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
}

export function writeBannerDismissed() {
  try { sessionStorage.setItem(BANNER_KEY, '1'); } catch { /* storage unavailable: dismissed for this page view only */ }
}
