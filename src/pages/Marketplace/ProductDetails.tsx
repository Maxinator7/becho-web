import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { Avatar, Chip, ListingCardData, Sheet, VerifiedByBecho, useCategories, useFavoriteIds } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { formatPrice, CONDITION_LABELS, EDITABLE_LISTING_STATUSES, LISTING_STATUS_LABELS, timeAgo } from '../../utils/format';
import {
  Heart, MessageSquare, MapPin, Tag, Play, Share2, Image as ImageIcon, Video, BadgeCheck, ChevronLeft, ChevronRight,
  Copy, Check, Info, Pencil, CheckCircle2, RotateCcw, Users, Search as SearchIcon, Handshake, ShieldCheck, Camera,
} from 'lucide-react';

interface ListingDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  condition: string;
  countryCode: string;
  stateCode: string;
  cityCode: string;
  locationVisibility: string;
  createdAt: string;
  verifiedAt?: string | null;
  seller: {
    id: string; displayName: string; createdAt: string; userCode?: string; status?: string;
    /** Only shown when the API includes them. */
    emailVerifiedAt?: string | null; phoneVerifiedAt?: string | null;
  };
  category: { id: string; name: string; slug: string };
  attributes: {
    id: string;
    valueText?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    attributeDefinition: { id?: string; name: string; slug?: string; dataType: string };
  }[];
  media: { id: string; url: string; mediaType?: string }[];
}

interface Offer {
  id: string;
  listingId?: string;
  listing?: { id: string };
  proposedById?: string;
  amount: number;
  status: string;
  message?: string;
  createdAt: string;
}

const OFFER_TONES: Record<string, 'warning' | 'success' | 'danger' | 'primary' | 'neutral'> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger',
  COUNTERED: 'primary',
  CANCELLED: 'neutral',
  EXPIRED: 'neutral',
};

interface AttributeDefinitionWithOptions { id: string; options?: { value: string; label: string }[] }

/** Suggested offers at about 95%, 97% and 99% of the asking price, rounded to a sensible step. */
function quickOffers(price: number): number[] {
  if (!Number.isFinite(price) || price <= 0) return [];
  const step = price >= 50000 ? 500 : price >= 5000 ? 100 : price >= 500 ? 10 : 1;
  const out: number[] = [];
  for (const pct of [0.95, 0.97, 0.99]) {
    const v = Math.max(step, Math.round((price * pct) / step) * step);
    if (v < price && !out.includes(v)) out.push(v);
  }
  return out;
}

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { areas } = useLocation();
  const [optionLabels, setOptionLabels] = useState<Record<string, string>>({});
  const [shareNote, setShareNote] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const { ids: favoriteIds, toggle: toggleFavorite } = useFavoriteIds();
  const categories = useCategories();
  const [moreFromSeller, setMoreFromSeller] = useState<{ items: ListingCardData[]; total: number }>({ items: [], total: 0 });
  const [quickAmount, setQuickAmount] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickNote, setQuickNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [contacting, setContacting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [existingOffer, setExistingOffer] = useState<Offer | null>(null);

  const loadListing = (listingId: string) => fetchApi<ListingDetail>(`/listings/${listingId}`);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setQuickNote(null);
    loadListing(id).then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setListing(res.data);
        setActiveMediaIndex(0);
        setOfferAmount(String(Math.floor(res.data.price * 0.9)));
        setQuickAmount(String(quickOffers(Number(res.data.price))[1] ?? ''));
        fetchApi<{ listings: ListingCardData[]; pagination: { total: number } }>(`/listings?sellerId=${res.data.seller.id}&excludeId=${res.data.id}&limit=3`).then((more) => {
          if (more.success && more.data) setMoreFromSeller({ items: more.data.listings ?? [], total: more.data.pagination?.total ?? 0 });
        });
        // Select attributes are stored as option values ("royal-enfield"); show their labels.
        fetchApi<AttributeDefinitionWithOptions[]>(`/categories/${res.data.category.id}/attributes`).then((attrs) => {
          if (!attrs.success || !attrs.data) return;
          const labels: Record<string, string> = {};
          for (const def of attrs.data) for (const o of def.options ?? []) labels[`${def.id}:${o.value}`] = o.label;
          setOptionLabels(labels);
        });
      } else {
        setErrorMsg(res.error?.message || 'Failed to load listing');
      }
    });
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    fetchApi<Offer[]>('/offers/mine').then((res) => {
      if (res.success && res.data) {
        const match = res.data.find(
          (o) => (o as any).listing?.id === id || (o as any).listingId === id
        );
        if (match) setExistingOffer(match);
      }
    });
  }, [user, id]);

  const handleToggleFavorite = () => { if (id) void toggleFavorite(id); };

  /** Sends an offer straight from the quick-offer box (it appears in the chat with the seller). */
  const sendQuickOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login', { state: { from: `/listings/${id}` } }); return; }
    if (!listing) return;
    const amount = Number(quickAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setQuickNote({ ok: false, text: 'Enter a valid amount.' }); return; }
    setQuickBusy(true);
    setQuickNote(null);
    const res = await fetchApi<Offer>('/offers', { method: 'POST', body: JSON.stringify({ listingId: listing.id, amount }) });
    setQuickBusy(false);
    if (res.success && res.data) {
      setExistingOffer(res.data);
      setQuickNote({ ok: true, text: `Offer of ${formatPrice(amount)} sent to ${listing.seller.displayName.split(' ')[0]}.` });
    } else {
      setQuickNote({ ok: false, text: res.error?.message || 'Could not send the offer.' });
    }
  };

  /** Owner actions: mark sold (also "Confirm sale" when reserved) and reopen a reservation. */
  const ownerAction = async (action: 'mark-sold' | 'mark-available') => {
    if (!listing) return;
    const question = action === 'mark-sold'
      ? (listing.status === 'RESERVED' ? 'Confirm the sale? The listing will be marked as sold.' : 'Mark this item as sold? Open offers will be closed.')
      : 'Reopen this listing? The reservation is cancelled and the item goes back on sale.';
    if (!window.confirm(question)) return;
    setOwnerBusy(true);
    setOwnerError('');
    const res = await fetchApi(`/listings/${listing.id}/${action}`, { method: 'POST' });
    if (res.success) {
      const fresh = await loadListing(listing.id);
      if (fresh.success && fresh.data) setListing(fresh.data);
    } else {
      setOwnerError(res.error?.message || 'Could not update the listing.');
    }
    setOwnerBusy(false);
  };

  const handleContactSeller = async () => {
    if (!user) { navigate('/login'); return; }
    if (!listing) return;
    setContacting(true);
    const res = await fetchApi<any>('/conversations/initiate', {
      method: 'POST',
      body: JSON.stringify({ listingId: listing.id }),
    });
    setContacting(false);
    if (res.success && res.data) {
      navigate(`/chat?conversationId=${res.data.id}`);
    } else {
      alert(res.error?.message || 'Failed to initiate conversation');
    }
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate('/login'); return; }
    if (!listing) return;
    setOfferError('');
    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) { setOfferError('Please enter a valid offer amount.'); return; }

    setSubmittingOffer(true);
    const res = await fetchApi<Offer>('/offers', {
      method: 'POST',
      body: JSON.stringify({ listingId: listing.id, amount, message: offerMessage || undefined }),
    });
    setSubmittingOffer(false);

    if (res.success && res.data) {
      setExistingOffer(res.data);
      setShowOfferModal(false);
      setOfferMessage('');
    } else {
      setOfferError(res.error?.message || 'Failed to submit offer.');
    }
  };

  const handleCancelOffer = async () => {
    if (!existingOffer) return;
    const res = await fetchApi<Offer>(`/offers/${existingOffer.id}/cancel`, { method: 'POST' });
    if (res.success && res.data) setExistingOffer(res.data);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: listing?.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote('Link copied');
    } catch {
      return;
    }
    setTimeout(() => setShareNote(''), 2000);
  };

  const copySellerCode = async () => {
    if (!listing?.seller.userCode) return;
    try {
      await navigator.clipboard.writeText(listing.seller.userCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch { /* clipboard blocked: the code is visible */ }
  };


  const shareButton = (
    <button type="button" className="icon-btn" onClick={handleShare} aria-label="Share listing" title={shareNote || 'Share'}>
      {shareNote ? <Check size={20} color="var(--success)" /> : <Share2 size={20} />}
    </button>
  );

  if (loading) return (
    <>
      <Navbar title="Listing details" hideTabs />
      <main className="page">
        <div className="muted" style={{ textAlign: 'center', padding: '64px 0' }}>Loading listing…</div>
      </main>
    </>
  );

  if (errorMsg || !listing) return (
    <>
      <Navbar title="Listing details" />
      <main className="page">
        <div className="card empty-state">
          <div className="empty-icon"><Tag size={24} /></div>
          <h1 className="section-title" style={{ marginBottom: '6px' }}>Listing not found</h1>
          <p className="secondary" style={{ marginBottom: '18px' }}>{errorMsg || 'This listing does not exist or was removed.'}</p>
          <Link to="/browse" className="btn-primary">Back to Explore</Link>
        </div>
      </main>
    </>
  );

  const images = listing.media ?? [];
  const mediaCount = images.length;
  const activeIdx = Math.min(activeMediaIndex, Math.max(0, mediaCount - 1));
  const activeMedia = images[activeIdx];
  const photoCount = images.filter((m) => m.mediaType !== 'VIDEO').length;
  const videoIndex = images.findIndex((m) => m.mediaType === 'VIDEO');

  const isSeller = user?.id === listing.seller.id;
  const area = areas.find((a) => a.cityCode === listing.cityCode);
  const cityName = area?.cityName ?? listing.cityCode;
  const stateName = area?.stateName ?? listing.stateCode;
  const sellerFirstName = listing.seller.displayName.split(' ')[0];
  const isFavorited = favoriteIds.has(listing.id);
  const price = Number(listing.price);
  const suggestions = quickOffers(price);

  const parentCat = categories.find((c) => c.id === listing.category?.id)
    ? null
    : categories.find((c) => c.children?.some((ch) => ch.id === listing.category?.id)) ?? null;

  const attrValue = (attr: ListingDetail['attributes'][number]) => {
    if (attr.valueText) {
      return (attr.attributeDefinition.id && optionLabels[`${attr.attributeDefinition.id}:${attr.valueText}`]) || attr.valueText;
    }
    if (attr.valueNumber !== undefined && attr.valueNumber !== null) {
      const n = Number(attr.valueNumber);
      return attr.attributeDefinition.dataType === 'CURRENCY' ? formatPrice(n) : n.toLocaleString('en-IN', { useGrouping: !/year/i.test(attr.attributeDefinition.name) });
    }
    if (attr.valueBoolean !== undefined && attr.valueBoolean !== null) return attr.valueBoolean ? 'Yes' : 'No';
    return '—';
  };

  const offerPending = existingOffer?.status === 'PENDING';
  const canOffer = !isSeller && listing.status === 'LIVE';
  const openOfferSheet = () => { if (!user) { navigate('/login', { state: { from: `/listings/${listing.id}` } }); return; } setShowOfferModal(true); };
  const editable = EDITABLE_LISTING_STATUSES.includes(listing.status);
  const statusLine = listing.status === 'LIVE' ? null
    : listing.status === 'RESERVED' ? (isSeller ? 'Reserved: you accepted an offer on this item' : 'Reserved: the seller has accepted an offer')
    : listing.status === 'SOLD' ? 'This item has been sold'
    : `Status: ${LISTING_STATUS_LABELS[listing.status]?.label ?? listing.status}`;

  const favButton = (
    <button
      type="button"
      onClick={handleToggleFavorite}
      className={`btn btn-soft fav-btn${isFavorited ? ' on' : ''}`}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Remove from saved' : 'Save'}
      title={isFavorited ? 'Remove from saved' : 'Save'}
    >
      <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
    </button>
  );

  const ownerActions = (compact: boolean) => (
    <>
      {editable && <Link to={`/listings/${listing.id}/edit`} className="btn btn-soft"><Pencil size={16} /> Edit listing</Link>}
      {listing.status === 'LIVE' && (
        <button type="button" className="btn-primary" disabled={ownerBusy} onClick={() => ownerAction('mark-sold')}><CheckCircle2 size={17} /> Mark as sold</button>
      )}
      {listing.status === 'RESERVED' && (
        <>
          <button type="button" className="btn btn-soft" disabled={ownerBusy} onClick={() => ownerAction('mark-available')}><RotateCcw size={16} /> Reopen{compact ? '' : ' listing'}</button>
          <button type="button" className="btn btn-deal" disabled={ownerBusy} onClick={() => ownerAction('mark-sold')}><CheckCircle2 size={17} /> Confirm sale</button>
        </>
      )}
      {!compact && <Link to="/my-listings" className="btn btn-ghost btn-sm">Manage in My listings</Link>}
    </>
  );

  return (
    <>
      <Navbar title="Listing details" actions={<>{shareButton}{!isSeller && <button type="button" className="icon-btn" onClick={handleToggleFavorite} aria-label={isFavorited ? 'Remove from saved' : 'Save'} aria-pressed={isFavorited} style={isFavorited ? { color: 'var(--danger-fill)' } : undefined}><Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} /></button>}</>} hideTabs />

      {showOfferModal && (
        <Sheet title={<><Tag size={20} color="var(--primary-text)" /> Make an offer</>} labelId="offer-title" onClose={() => { setShowOfferModal(false); setOfferError(''); }}>
          <p className="secondary" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
            Listed at <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(price)}</strong>. Your offer goes straight to {sellerFirstName} in the chat.
          </p>
          <form onSubmit={handleSubmitOffer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {suggestions.length > 0 && (
              <div className="qo-chips" role="group" aria-label="Suggested offers">
                {suggestions.map((v) => (
                  <button key={v} type="button" className={`qo-chip${Number(offerAmount) === v ? ' on' : ''}`} aria-pressed={Number(offerAmount) === v} onClick={() => setOfferAmount(String(v))}>{formatPrice(v)}</button>
                ))}
              </div>
            )}
            <div>
              <label htmlFor="offer-amount-input" className="field-label">Your offer</label>
              <div className="price-input">
                <span className="cur" aria-hidden="true">₹</span>
                <input id="offer-amount-input" type="number" min="1" step="0.01" inputMode="decimal" value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} required />
              </div>
              {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                <div style={{ fontSize: '0.78rem', color: parseFloat(offerAmount) < price ? 'var(--warning)' : 'var(--success)', marginTop: '6px' }}>
                  {Math.round(Math.abs(1 - parseFloat(offerAmount) / price) * 100)}%
                  {parseFloat(offerAmount) < price ? ' below' : ' above'} asking price
                </div>
              )}
            </div>
            <div>
              <label htmlFor="offer-message-input" className="field-label">Message to seller <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea id="offer-message-input" className="input" value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} placeholder="e.g. I can pick it up today" rows={3} />
            </div>
            {offerError && <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)' }}>{offerError}</div>}
            <button type="submit" id="offer-submit-btn" disabled={submittingOffer} className="btn-primary btn-lg btn-block">
              {submittingOffer ? 'Sending offer…' : 'Send offer'}
            </button>
          </form>
        </Sheet>
      )}

      <main className="page pd-page pd-v2">
        <div className="pd-topline desktop-only">
          <nav className="crumbs" aria-label="Breadcrumb" style={{ marginBottom: 0 }}>
            <Link to="/">Home</Link><ChevronRight size={14} />
            {parentCat && <><Link to={`/browse?categoryId=${parentCat.id}`}>{parentCat.name}</Link><ChevronRight size={14} /></>}
            {listing.category && <><Link to={`/browse?categoryId=${listing.category.id}`}>{listing.category.name}</Link><ChevronRight size={14} /></>}
            <span aria-current="page" className="crumb-last">{listing.title}</span>
          </nav>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleShare}>{shareNote ? <><Check size={16} /> {shareNote}</> : <><Share2 size={16} /> Share</>}</button>
        </div>

        <div className="pd-layout">
          <div className="pd-main">
            {/* Gallery */}
            <div className="pd-gallery-block pd-card">
              <div className="gallery">
                {!activeMedia ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={40} /></div>
                ) : activeMedia.mediaType === 'VIDEO' ? (
                  <video key={activeMedia.id} src={activeMedia.url} controls playsInline preload="metadata" />
                ) : (
                  <img src={activeMedia.url} alt={listing.title} />
                )}
                {mediaCount > 0 && activeMedia?.mediaType !== 'VIDEO' && (
                  <span className="g-count g-count-v2"><Camera size={13} /> {images.slice(0, activeIdx + 1).filter((m) => m.mediaType !== 'VIDEO').length} of {photoCount}</span>
                )}
                {videoIndex >= 0 && activeIdx !== videoIndex && (
                  <button type="button" className="g-video chip chip-photo chip-upper" style={{ padding: '5px 10px' }} onClick={() => setActiveMediaIndex(videoIndex)}>
                    <Video size={13} /> Video
                  </button>
                )}
                {mediaCount > 1 && (
                  <>
                    <button type="button" className="g-nav prev desktop-only" aria-label="Previous" onClick={() => setActiveMediaIndex((activeIdx - 1 + mediaCount) % mediaCount)}><ChevronLeft size={20} /></button>
                    <button type="button" className="g-nav next desktop-only" aria-label="Next" onClick={() => setActiveMediaIndex((activeIdx + 1) % mediaCount)}><ChevronRight size={20} /></button>
                    {activeMedia?.mediaType !== 'VIDEO' && (
                      <div className="g-dots">
                        {images.map((m, i) => (
                          <button key={m.id} type="button" className={i === activeIdx ? 'on' : ''} aria-label={m.mediaType === 'VIDEO' ? 'Video' : `Photo ${i + 1}`} aria-current={i === activeIdx} onClick={() => setActiveMediaIndex(i)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {mediaCount > 1 && (
                <div className="thumbs">
                  {images.map((media, idx) => (
                    <button key={media.id} type="button" onClick={() => setActiveMediaIndex(idx)} className={idx === activeIdx ? 'on' : ''} aria-label={media.mediaType === 'VIDEO' ? 'Play video' : `Photo ${idx + 1}`}>
                      {media.mediaType === 'VIDEO' ? (
                        <>
                          <video src={media.url} muted preload="metadata" />
                          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff' }}><Play size={20} fill="#fff" /></span>
                        </>
                      ) : (
                        <img src={media.url} alt="" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Chips + title + price */}
            <div className="pd-summary-block">
              <div className="pd-chips">
                {listing.verifiedAt && <VerifiedByBecho />}
                <span className="pd-chip"><CheckCircle2 size={14} /> {CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
                <span className="pd-chip desktop-only"><MapPin size={14} /> {cityName}, {stateName} · Listed {timeAgo(listing.createdAt)}</span>
              </div>
              <div className="pd-card pd-titlecard">
                <div className="pd-overline">{listing.category?.name || 'General'}</div>
                <h1 className="pd-title">{listing.title}</h1>
                <div className="pd-price-row">
                  <span className="price pd-price">{formatPrice(price)}</span>
                </div>
                <div className="pd-loc mobile-only"><MapPin size={14} /> {cityName}, {stateName} <span aria-hidden="true">·</span> Posted {timeAgo(listing.createdAt)}</div>
                {statusLine && <div className="pd-status">{statusLine}</div>}
              </div>
            </div>

            {/* Specs + description + safety */}
            <div className="pd-details-block">
              <section className="pd-card" aria-labelledby="pd-specs">
                <div className="pd-sec-head">
                  <h2 id="pd-specs" className="section-title">Item specifications</h2>
                </div>
                <div className="spec-grid v2">
                  <div className="spec-card">
                    <div className="spec-label">Condition</div>
                    <div className="spec-value accent">{CONDITION_LABELS[listing.condition] ?? listing.condition}</div>
                  </div>
                  {(listing.attributes ?? []).map((attr) => (
                    <div key={attr.id} className="spec-card">
                      <div className="spec-label">{attr.attributeDefinition.name}</div>
                      <div className="spec-value">{attrValue(attr)}</div>
                    </div>
                  ))}
                  <div className="spec-card">
                    <div className="spec-label">Category</div>
                    <div className="spec-value">{listing.category?.name || 'General'}</div>
                  </div>
                </div>
              </section>

              <section className="pd-card" aria-labelledby="pd-desc">
                <h2 id="pd-desc" className="section-title" style={{ marginBottom: '10px' }}>Seller’s description</h2>
                <p className="pd-desc">{listing.description}</p>
              </section>

              <section className="safety" aria-labelledby="pd-safety">
                <h2 id="pd-safety"><ShieldCheck size={20} /> Becho safe trading advice</h2>
                <div className="safety-grid">
                  <div><Users size={18} /><div><strong>Public meetup</strong><span>Meet in a busy, well-lit public place.</span></div></div>
                  <div><SearchIcon size={18} /><div><strong>Inspect in person</strong><span>Check the item works before you pay.</span></div></div>
                  <div><Handshake size={18} /><div><strong>Deal directly</strong><span>Pay the seller only after the handover. Never pay in advance.</span></div></div>
                </div>
              </section>
            </div>
          </div>

          <div className="pd-side">
            {/* Price + actions */}
            <div className="pd-actions-block pd-card">
              <div className="muted" style={{ fontSize: '0.84rem' }}>{isSeller ? 'Your asking price' : 'Listed price'}</div>
              <div className="price pd-side-price">{formatPrice(price)}</div>
              {statusLine && <div className="pd-status" style={{ marginTop: 8 }}>{statusLine}</div>}

              {existingOffer && !isSeller && (
                <div className={`remark-box ${existingOffer.status === 'ACCEPTED' ? 'info' : existingOffer.status === 'REJECTED' ? 'danger' : 'warn'}`} style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {existingOffer.proposedById === user?.id ? 'Your offer' : 'Seller counter-offer'}: {formatPrice(existingOffer.amount)}
                  </span>
                  <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                    <Chip tone={OFFER_TONES[existingOffer.status] ?? 'neutral'} upper>{existingOffer.status}</Chip>
                    {offerPending && <button id="cancel-offer-btn" type="button" onClick={handleCancelOffer} className="link" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Cancel offer</button>}
                  </span>
                </div>
              )}

              {isSeller ? (
                <>
                  <div className="info-strip" style={{ margin: '14px 0 0' }}><Info size={16} /> This is your listing.</div>
                  {ownerError && <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)', marginTop: 10 }}>{ownerError}</div>}
                  <div className="pd-owner desktop-only">{ownerActions(false)}</div>
                  <div className="action-bar sticky-mobile mobile-only">{ownerActions(true)}</div>
                </>
              ) : (
                <>
                  <div className="pd-cta desktop-only">
                    <button id="contact-seller-btn" type="button" onClick={handleContactSeller} disabled={contacting} className="btn-primary btn-lg btn-block">
                      <MessageSquare size={19} /> {contacting ? 'Connecting…' : 'Chat with seller'}
                    </button>
                    {canOffer && (
                      <button id="make-offer-btn" type="button" className="btn btn-soft btn-lg btn-block" onClick={openOfferSheet} disabled={offerPending}>
                        <Tag size={18} /> {offerPending ? 'Offer pending' : existingOffer ? 'Make a new offer' : 'Make an offer'}
                      </button>
                    )}
                  </div>

                  {canOffer && !offerPending && suggestions.length > 0 && (
                    <form className="quick-offer desktop-only" onSubmit={sendQuickOffer} aria-labelledby="qo-title">
                      <div className="qo-head">
                        <span id="qo-title">Quick offer suggestions</span>
                        <span className="muted">Sent directly to chat</span>
                      </div>
                      <div className="qo-chips">
                        {suggestions.map((v) => (
                          <button key={v} type="button" className={`qo-chip${Number(quickAmount) === v ? ' on' : ''}`} aria-pressed={Number(quickAmount) === v} onClick={() => setQuickAmount(String(v))}>{formatPrice(v)}</button>
                        ))}
                      </div>
                      <div className="qo-row">
                        <label className="qo-input">
                          <span aria-hidden="true">₹</span>
                          <span className="sr-only">Offer amount</span>
                          <input type="number" min={1} inputMode="numeric" value={quickAmount} onChange={(e) => setQuickAmount(e.target.value)} />
                        </label>
                        <button type="submit" className="btn-primary" disabled={quickBusy}>{quickBusy ? 'Sending…' : 'Send offer'}</button>
                      </div>
                    </form>
                  )}
                  {quickNote && (
                    <div role={quickNote.ok ? 'status' : 'alert'} className={`remark-box ${quickNote.ok ? 'info' : 'danger'}`} style={{ marginTop: 10, color: quickNote.ok ? 'var(--text-primary)' : 'var(--danger)' }}>
                      {quickNote.text} {quickNote.ok && <button type="button" className="link" onClick={handleContactSeller}>Open chat</button>}
                    </div>
                  )}

                  <button type="button" className={`wish-btn desktop-only${isFavorited ? ' on' : ''}`} onClick={handleToggleFavorite} aria-pressed={isFavorited}>
                    <Heart size={18} fill={isFavorited ? 'currentColor' : 'none'} /> {isFavorited ? 'Saved to wishlist' : 'Save to wishlist'}
                  </button>

                  {/* Phone: sticky action bar */}
                  <div className="action-bar sticky-mobile mobile-only">
                    {favButton}
                    {canOffer && (
                      <button type="button" className="btn btn-outline" onClick={openOfferSheet} disabled={offerPending} style={{ flex: 1 }}>
                        <Tag size={17} /> {offerPending ? 'Offer pending' : 'Make an offer'}
                      </button>
                    )}
                    <button type="button" onClick={handleContactSeller} disabled={contacting} className="btn-primary" style={{ flex: 1.2, minWidth: 0 }}>
                      <MessageSquare size={18} /> {contacting ? 'Connecting…' : 'Chat with seller'}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Seller */}
            <section className="pd-seller-block pd-card" aria-label="Seller">
              <div className="seller-top">
                <Avatar name={listing.seller.displayName} size="md" style={{ borderRadius: 12 }} />
                <div style={{ minWidth: 0 }}>
                  <div className="seller-name">{listing.seller.displayName}</div>
                  <div className="muted" style={{ fontSize: '0.84rem' }}>Member since {new Date(listing.seller.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                  <div className="link" style={{ fontSize: '0.82rem' }}>{cityName}</div>
                </div>
              </div>
              <div className="seller-chips">
                {listing.seller.emailVerifiedAt && <span className="ok-chip"><BadgeCheck size={15} /> Email verified</span>}
                {listing.seller.phoneVerifiedAt && <span className="ok-chip"><BadgeCheck size={15} /> Mobile verified</span>}
                {!listing.seller.emailVerifiedAt && !listing.seller.phoneVerifiedAt && listing.seller.status === 'ACTIVE' && (
                  <span className="ok-chip"><BadgeCheck size={15} /> Verified account</span>
                )}
              </div>
              {listing.seller.userCode && (
                <div className="seller-code">
                  <span className="muted">Seller ID</span>
                  <code>{listing.seller.userCode}</code>
                  <button type="button" onClick={copySellerCode} className="link" aria-label="Copy seller ID" style={{ marginLeft: 'auto', fontSize: '0.78rem', display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                    {copiedCode ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                  </button>
                </div>
              )}

              {moreFromSeller.items.length > 0 && (
                <div className="more-seller">
                  <div className="ms-head">
                    <span>More from {sellerFirstName}</span>
                    <span className="link" style={{ fontSize: '0.82rem' }}>{moreFromSeller.total} other ad{moreFromSeller.total === 1 ? '' : 's'}</span>
                  </div>
                  {moreFromSeller.items.map((m) => {
                    const photo = m.media?.find((x) => x.mediaType !== 'VIDEO')?.url ?? m.media?.[0]?.url;
                    return (
                      <Link key={m.id} to={`/listings/${m.id}`} className="ms-row">
                        {photo ? <img src={photo} alt="" /> : <span className="ms-noimg"><Tag size={18} /></span>}
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span className="ms-title">{m.title}</span>
                          {m.category?.name && <span className="ms-sub">{m.category.name}</span>}
                          <span className="ms-price">{formatPrice(Number(m.price))}</span>
                        </span>
                        <ChevronRight size={18} className="muted" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};
