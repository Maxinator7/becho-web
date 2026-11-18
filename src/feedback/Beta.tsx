import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';
import { FeedbackDialog } from './FeedbackDialog';
import { readBannerDismissed, writeBannerDismissed, type FeedbackSource } from './feedback';

/*
 * Closed-beta chrome shared by the marketplace and admin portal: a dismissible banner,
 * a small "Beta" chip once dismissed, and the feedback dialog. Markup uses neutral
 * `beta-*` / `fb-*` classes styled by each app's stylesheet.
 */

/** Renders the beta terms & privacy link; `newTab` is set where leaving would lose typed input. */
export type PrivacyLink = (className: string, children: React.ReactNode, newTab?: boolean) => React.ReactNode;

interface BetaContextValue {
  bannerDismissed: boolean;
  dismissBanner: () => void;
  openFeedback: () => void;
  privacyLink?: PrivacyLink;
}

const BetaContext = createContext<BetaContextValue>({
  bannerDismissed: false,
  dismissBanner: () => {},
  openFeedback: () => {},
});

export const useBeta = () => useContext(BetaContext);

export const BetaProvider: React.FC<{ source: FeedbackSource; privacyLink?: PrivacyLink; children: React.ReactNode }> = ({ source, privacyLink, children }) => {
  const [bannerDismissed, setDismissed] = useState(readBannerDismissed);
  const [open, setOpen] = useState(false);
  const dismissBanner = useCallback(() => { writeBannerDismissed(); setDismissed(true); }, []);
  const openFeedback = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ bannerDismissed, dismissBanner, openFeedback, privacyLink }), [bannerDismissed, dismissBanner, openFeedback, privacyLink]);
  return (
    <BetaContext.Provider value={value}>
      {children}
      {open && <FeedbackDialog source={source} onClose={close} privacyLink={privacyLink} />}
    </BetaContext.Provider>
  );
};

/** Slim strip at the very top of every page until dismissed for this browser session. */
/**
 * Publishes the banner's rendered height as `--beta-bar-h` on <html> (0px when hidden), so
 * viewport-height layouts such as the chat screen can subtract it instead of using magic numbers.
 */
function useBannerHeightVar(ref: React.RefObject<HTMLElement>, shown: boolean) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const node = ref.current;
    if (!shown || !node) { root.style.setProperty('--beta-bar-h', '0px'); return; }
    const update = () => root.style.setProperty('--beta-bar-h', `${node.getBoundingClientRect().height}px`);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(node);
    return () => { ro?.disconnect(); root.style.setProperty('--beta-bar-h', '0px'); };
  }, [ref, shown]);
}

export const BetaBanner: React.FC = () => {
  const { bannerDismissed, dismissBanner, openFeedback, privacyLink } = useBeta();
  const ref = useRef<HTMLDivElement>(null);
  useBannerHeightVar(ref, !bannerDismissed);
  if (bannerDismissed) return null;
  return (
    <div ref={ref} className="beta-bar" role="region" aria-label="Beta notice">
      <div className="beta-bar__inner">
        <p className="beta-bar__text">
          <span className="beta-bar__tag">Beta</span>
          <span className="beta-bar__sep" aria-hidden>·</span>
          <span>You’re testing an early version of Becho. <span className="beta-bar__more">Data may be reset.</span></span>
        </p>
        <div className="beta-bar__links">
          <button type="button" className="beta-bar__link" onClick={openFeedback}>Send feedback</button>
          {privacyLink && <>
            <span className="beta-bar__dot" aria-hidden>·</span>
            {privacyLink('beta-bar__link', 'Beta terms & privacy')}
          </>}
        </div>
        <button type="button" className="beta-bar__close" onClick={dismissBanner} aria-label="Dismiss beta notice" title="Hide for this session">
          <X size={15} />
        </button>
      </div>
    </div>
  );
};

/** Small "Beta" chip shown next to the logo after the banner is dismissed; opens the feedback dialog. */
export const BetaChip: React.FC<{ className?: string; always?: boolean }> = ({ className = '', always }) => {
  const { bannerDismissed, openFeedback } = useBeta();
  if (!bannerDismissed && !always) return null;
  return (
    <button type="button" className={`beta-chip ${className}`} onClick={openFeedback} title="Becho is in beta — send feedback" aria-label="Beta: send feedback">
      Beta
    </button>
  );
};

/**
 * Floating "Feedback" button: a labelled pill on desktop, a compact circle above the tab bar on phones.
 * `phone={false}` hides it at phone widths (screens with their own sticky bottom bar).
 */
export const FeedbackFab: React.FC<{ phone?: boolean }> = ({ phone = true }) => {
  const { openFeedback } = useBeta();
  return (
    <button type="button" className={`fb-fab${phone ? '' : ' fb-fab--no-phone'}`} onClick={openFeedback} title="Send feedback">
      <MessageSquarePlus size={17} aria-hidden /> <span className="fb-fab__label">Feedback</span>
    </button>
  );
};
