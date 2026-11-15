import type { PostHog } from 'posthog-js';

/**
 * PostHog product analytics for the marketplace and admin apps.
 * Off unless VITE_POSTHOG_KEY is set; the library is then loaded on demand as a separate chunk,
 * so it never weighs down the app when analytics is disabled.
 * Captures page views (SPA route changes), UTM campaign parameters, and session replays with
 * every input masked. Never sends email/phone.
 */
const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://us.i.posthog.com';

let client: Promise<PostHog | null> = Promise.resolve(null);

export function initAnalytics(app: 'marketplace' | 'admin') {
  if (!KEY) return;
  client = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        capture_pageview: 'history_change',
        capture_pageleave: true,
        person_profiles: 'identified_only',
        session_recording: { maskAllInputs: true, maskTextSelector: '[data-private]' },
      });
      posthog.register({ app });
      return posthog;
    })
    .catch(() => null); // blocked by an ad-blocker or offline: carry on without analytics
}

let identifiedId: string | null = null;

/**
 * Call with the signed-in user, or null when signed out. Only an actual sign-out (a previously
 * identified user going away) resets the anonymous id — never the initial "not signed in yet" state,
 * otherwise every visit would look like a new visitor and campaign attribution would break.
 */
export function identifyUser(user: { id: string; userCode?: string; role?: string; status?: string } | null) {
  if (user && user.id === identifiedId) return;
  const signingOut = !user && identifiedId !== null;
  identifiedId = user?.id ?? null;
  void client.then((ph) => {
    if (!ph) return;
    if (user) ph.identify(user.id, { userCode: user.userCode, role: user.role, status: user.status });
    else if (signingOut) ph.reset();
  });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  void client.then((ph) => ph?.capture(event, properties));
}
