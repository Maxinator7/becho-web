import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquarePlus } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { useBeta } from '../feedback/Beta';

/*
 * Beta privacy notice and test terms. Source of truth: docs/beta-privacy.md —
 * keep this page in sync when that file changes (it is rendered here as JSX, no markdown runtime).
 */
export const PRIVACY_LAST_UPDATED = '18 November 2026';

export const Privacy: React.FC = () => {
  const { openFeedback } = useBeta();
  useEffect(() => {
    const prev = document.title;
    document.title = 'Beta terms & privacy · Becho';
    return () => { document.title = prev; };
  }, []);

  return (
    <>
      <Navbar title="Beta terms & privacy" />
      <main className="page legal-page">
        <article className="legal">
          <div className="overline">Closed beta</div>
          <h1 className="page-title">Becho beta — privacy notice and test terms</h1>
          <p className="legal-updated">Last updated: {PRIVACY_LAST_UPDATED}</p>

          <p className="legal-lead">
            Becho is in a <strong>closed beta</strong>. You’ve been invited to try an early version and tell us what works and what doesn’t.
            Please read this short notice before you sign up.
          </p>

          <section aria-labelledby="pv-test">
            <h2 id="pv-test">This is a test version</h2>
            <ul>
              <li>
                Features may change, break or disappear, and <strong>all beta data (accounts, listings, chats) may be reset or deleted</strong> at
                any time, including at the end of the beta.
              </li>
              <li>Demo listings marked “(Demo)” are examples, not real items for sale.</li>
              <li>
                Becho does not handle payments. If you choose to meet someone and exchange an item, that’s between the two of you — meet in a
                public place and check the item before paying.
              </li>
              <li>
                Please <strong>don’t upload</strong> identity documents, bank details or anything you wouldn’t want a small group of testers to see.
              </li>
            </ul>
          </section>

          <section aria-labelledby="pv-collect">
            <h2 id="pv-collect">What we collect</h2>
            <ul>
              <li><strong>Account details:</strong> your name, email address and mobile number, and your password (stored only as a one-way hash).</li>
              <li><strong>What you post and do:</strong> listings, photos and videos, chat messages, offers, saved ads and feedback you send.</li>
              <li>
                <strong>Technical and usage data:</strong> device and browser type, pages and screens you visit, and clicks. On the website we use
                PostHog analytics, which can record sessions to help us find bugs — <strong>everything you type into forms is masked</strong> and never
                recorded.
              </li>
            </ul>
          </section>

          <section aria-labelledby="pv-why">
            <h2 id="pv-why">Why we use it</h2>
            <p>
              To run the beta (sign-in, listings, chat and offers), to keep it safe (screening listings, stopping abuse), and to improve Becho
              based on how it’s used and what you tell us.
            </p>
          </section>

          <section aria-labelledby="pv-who">
            <h2 id="pv-who">Who processes it</h2>
            <p>
              Our service providers store or process data on our behalf: Neon (database), Render (servers), Cloudflare (website and photo
              storage), Brevo (verification emails) and PostHog (analytics). We don’t sell your data or use it for advertising.
            </p>
          </section>

          <section aria-labelledby="pv-choices">
            <h2 id="pv-choices">Your choices</h2>
            <ul>
              <li>You can edit your name and see your details on the <Link to="/account" className="link">Account</Link> page.</li>
              <li>
                To have your account and data deleted, send us a request through the <strong>Feedback</strong> button (choose “Other” and write
                “Delete my account”). We’ll confirm when it’s done.
              </li>
              <li>By creating an account you agree to these beta terms and this notice.</li>
            </ul>
          </section>

          <div className="legal-cta">
            <div>
              <div className="legal-cta__title">Questions, or want your data deleted?</div>
              <div className="secondary">Send it through the feedback form — it goes straight to the Becho team.</div>
            </div>
            <button type="button" className="btn-primary" onClick={openFeedback}><MessageSquarePlus size={17} /> Send feedback</button>
          </div>
        </article>
      </main>
    </>
  );
};
