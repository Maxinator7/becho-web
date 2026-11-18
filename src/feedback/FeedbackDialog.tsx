import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bug, CheckCircle2, HelpCircle, Lightbulb, Loader2, MoreHorizontal, Star, ThumbsUp, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  APP_VERSION, FEEDBACK_CATEGORIES, FEEDBACK_MAX, FEEDBACK_MIN, type FeedbackCategory, type FeedbackSource, feedbackError, submitFeedback,
} from './feedback';

/*
 * Beta feedback dialog, shared by the marketplace and the admin portal.
 * Markup uses neutral `fb-*` classes; each app styles them with its own tokens
 * (src/index.css for the marketplace, src/admin/admin.css under .admin-root).
 */

const CATEGORY_ICONS: Record<FeedbackCategory, typeof Bug> = {
  BUG: Bug, IDEA: Lightbulb, CONFUSING: HelpCircle, PRAISE: ThumbsUp, OTHER: MoreHorizontal,
};
const RATING_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Great'];

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside the dialog, closes on Escape, locks page scroll and restores focus on close. */
function useDialogBehaviour(ref: React.RefObject<HTMLElement>, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      // Radios in a group are one tab stop: only the checked one (or the first when none is) counts.
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
        if (el instanceof HTMLInputElement && el.type === 'radio' && !el.checked) {
          const group = node.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${el.name}"]`);
          return !Array.from(group).some((r) => r.checked) && group[0] === el;
        }
        return el.getClientRects().length > 0;
      });
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [ref]);
}

export const FeedbackDialog: React.FC<{
  source: FeedbackSource;
  onClose: () => void;
  /** Renders the "Beta terms & privacy" link (router link or external URL), or null to omit it. */
  privacyLink?: (className: string, children: React.ReactNode, newTab?: boolean) => React.ReactNode;
}> = ({ source, onClose, privacyLink }) => {
  const { user } = useAuth();
  const uid = useId();
  const ids = { title: `${uid}-title`, desc: `${uid}-desc`, msg: `${uid}-msg`, msgHelp: `${uid}-msg-help`, catErr: `${uid}-cat-err` };
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // Captured when the dialog opens: the page the tester was looking at.
  const page = useMemo(() => `${window.location.pathname}${window.location.search}`.slice(0, 300), []);

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [contactOk, setContactOk] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useDialogBehaviour(dialogRef, onClose);
  useEffect(() => { (sent ? doneRef.current : firstFieldRef.current)?.focus(); }, [sent]);

  const trimmed = message.trim();
  const catError = submitted && !category ? 'Choose what kind of feedback this is' : undefined;
  const msgError = submitted && trimmed.length < FEEDBACK_MIN ? `Tell us a little more (at least ${FEEDBACK_MIN} characters)` : undefined;
  const hint = FEEDBACK_CATEGORIES.find((c) => c.value === category)?.hint ?? 'Pick a type above, then tell us what’s on your mind.';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError(null);
    if (!category) { firstFieldRef.current?.focus(); return; }
    if (trimmed.length < FEEDBACK_MIN) { messageRef.current?.focus(); return; }
    setSending(true);
    const res = await submitFeedback({
      source, category, message: trimmed, page, appVersion: APP_VERSION,
      ...(rating ? { rating } : {}),
      ...(user ? { contactOk } : {}),
    });
    setSending(false);
    if (res.success) setSent(true);
    else setError(feedbackError(res));
  };

  const reset = () => {
    setCategory(null); setRating(null); setMessage(''); setContactOk(false);
    setSubmitted(false); setError(null); setSent(false);
  };

  const shown = hover ?? rating ?? 0;

  return (
    <div className="fb-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="fb-dialog" role="dialog" aria-modal="true" aria-labelledby={ids.title} aria-describedby={ids.desc}>
        <div className="fb-head">
          <div style={{ minWidth: 0 }}>
            <div className="fb-overline"><span className="fb-beta">Beta</span> Becho team inbox</div>
            <h2 id={ids.title} className="fb-title">{sent ? 'Feedback sent' : 'Send feedback'}</h2>
          </div>
          <button type="button" className="fb-close" onClick={onClose} aria-label="Close feedback"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="fb-done" role="status">
            <span className="fb-done__icon" aria-hidden><CheckCircle2 size={28} /></span>
            <p id={ids.desc} className="fb-done__title">Thanks — sent to the Becho team</p>
            <p className="fb-done__text">We read every message during the beta.{user && contactOk ? ' We may get in touch about it.' : ''}</p>
            <div className="fb-actions">
              <button type="button" className="fb-btn fb-btn--ghost" onClick={reset}>Send more</button>
              <button ref={doneRef} type="button" className="fb-btn fb-btn--primary" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <form className="fb-form" onSubmit={submit} noValidate>
            <p id={ids.desc} className="fb-sub">Found a bug or have an idea? It goes straight to the people building Becho.</p>

            {error && (
              <div className="fb-alert" role="alert"><AlertCircle size={16} /> <span>{error}</span></div>
            )}

            <fieldset className="fb-fieldset" aria-describedby={catError ? ids.catErr : undefined}>
              <legend className="fb-legend">What kind of feedback? <span className="fb-req" aria-hidden>*</span></legend>
              <div className="fb-chips">
                {FEEDBACK_CATEGORIES.map((c, i) => {
                  const Icon = CATEGORY_ICONS[c.value];
                  return (
                    <label key={c.value} className={`fb-chip${category === c.value ? ' is-on' : ''}`}>
                      <input
                        ref={i === 0 ? firstFieldRef : undefined}
                        type="radio" name={`${uid}-cat`} value={c.value} className="fb-radio"
                        checked={category === c.value} onChange={() => setCategory(c.value)}
                        aria-invalid={!!catError} required
                      />
                      <Icon size={15} aria-hidden /> {c.label}
                    </label>
                  );
                })}
              </div>
              {catError && <div id={ids.catErr} className="fb-err">{catError}</div>}
            </fieldset>

            <fieldset className="fb-fieldset">
              <legend className="fb-legend">How’s Becho so far? <span className="fb-opt">(optional)</span></legend>
              <div className="fb-stars-row">
                <div className="fb-stars" onMouseLeave={() => setHover(null)}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className={`fb-star${n <= shown ? ' is-on' : ''}`} onMouseEnter={() => setHover(n)} title={`${n} – ${RATING_WORDS[n]}`}>
                      <input type="radio" name={`${uid}-rating`} value={n} className="fb-radio" checked={rating === n} onChange={() => setRating(n)} aria-label={`${n} star${n > 1 ? 's' : ''} – ${RATING_WORDS[n]}`} />
                      <Star size={24} fill={n <= shown ? 'currentColor' : 'none'} aria-hidden />
                    </label>
                  ))}
                </div>
                <span className="fb-stars-word" aria-hidden>{shown ? RATING_WORDS[shown] : ''}</span>
                {rating && <button type="button" className="fb-link-btn" onClick={() => { setRating(null); setHover(null); }}>Clear rating</button>}
              </div>
            </fieldset>

            <div>
              <label htmlFor={ids.msg} className="fb-legend">Your message <span className="fb-req" aria-hidden>*</span></label>
              <textarea
                ref={messageRef} id={ids.msg} className="fb-textarea" rows={5} maxLength={FEEDBACK_MAX} required
                value={message} onChange={(e) => setMessage(e.target.value)} placeholder={hint}
                aria-invalid={!!msgError} aria-describedby={ids.msgHelp}
              />
              <div id={ids.msgHelp} className="fb-meta">
                <span className={msgError ? 'fb-err' : ''}>{msgError ?? 'Please don’t include passwords or bank details.'}</span>
                <span className={message.length > FEEDBACK_MAX - 100 ? 'fb-count is-near' : 'fb-count'} aria-live="polite">{message.length} / {FEEDBACK_MAX}</span>
              </div>
            </div>

            {user && (
              <label className="fb-check">
                <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
                <span>You can contact me about this <span className="fb-opt">(we’ll use the email or mobile on your account)</span></span>
              </label>
            )}

            <p className="fb-context">
              Sent with: page <code>{page}</code> · version {APP_VERSION}{user ? ` · signed in as ${user.displayName}` : ' · not signed in'}
              {privacyLink && <> · {privacyLink('fb-inline-link', 'Privacy notice', true)}</>}
            </p>

            <div className="fb-actions">
              <button type="button" className="fb-btn fb-btn--ghost" onClick={onClose} disabled={sending}>Cancel</button>
              <button type="submit" className="fb-btn fb-btn--primary" disabled={sending} aria-busy={sending}>
                {sending && <Loader2 size={15} className="fb-spin" aria-hidden />} {sending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
