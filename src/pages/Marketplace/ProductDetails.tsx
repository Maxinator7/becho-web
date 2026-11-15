import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { Avatar, Chip, Sheet } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { formatPrice, CONDITION_LABELS, LISTING_STATUS_LABELS, timeAgo } from '../../utils/format';
import {
  Heart, MessageCircle, MapPin, Clock, ArrowLeft, Tag, Play, Share2, Image as ImageIcon, Video, BadgeCheck,
  ChevronLeft, ChevronRight, Copy, Check, Hash, CalendarDays, Info,
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
  seller: { id: string; displayName: string; createdAt: string; userCode?: string; status?: string };
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
  const [isFavorited, setIsFavorited] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Offer state
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [existingOffer, setExistingOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchApi<ListingDetail>(`/listings/${id}`).then((res) => {
      setLoading(false);
      if (res.success && res.data) {
        setListing(res.data);
        setActiveMediaIndex(0);
        setOfferAmount(String(Math.floor(res.data.price * 0.9)));
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

  const handleToggleFavorite = async () => {
    if (!user) { navigate('/login'); return; }
    if (!id) return;
    const res = await fetchApi<{ favorited: boolean }>(`/favorites/${id}`, { method: 'POST' });
    if (res.success && res.data) setIsFavorited(res.data.favorited);
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

  const images = listing.media && listing.media.length > 0
    ? listing.media
    : [];
  const mediaCount = images.length;
  const activeIdx = Math.min(activeMediaIndex, Math.max(0, mediaCount - 1));
  const activeMedia = images[activeIdx];
  const photoCount = images.filter((m) => m.mediaType !== 'VIDEO').length;
  const videoIndex = images.findIndex((m) => m.mediaType === 'VIDEO');

  const isSeller = user?.id === listing.seller.id;
  const cityName = areas.find((a) => a.cityCode === listing.cityCode)?.cityName ?? listing.cityCode;
  const stateName = areas.find((a) => a.cityCode === listing.cityCode)?.stateName ?? listing.stateCode;
  const sellerFirstName = listing.seller.displayName.split(' ')[0];

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
  const brand = listing.attributes?.find((a) => /brand|make/i.test(a.attributeDefinition.name));
  const specs = (listing.attributes ?? []).filter((a) => a !== brand);

  const offerPending = existingOffer?.status === 'PENDING';
  const canOffer = !isSeller && listing.status === 'LIVE';
  const favButton = (extra = '') => (
    <button
      type="button"
      onClick={handleToggleFavorite}
      className={`btn btn-outline ${extra}`}
      aria-pressed={isFavorited}
      aria-label={isFavorited ? 'Remove from saved' : 'Save'}
      title={isFavorited ? 'Remove from saved' : 'Save'}
      style={{ width: 46, padding: 0, flexShrink: 0, color: isFavorited ? 'var(--danger-fill)' : 'var(--text-primary)' }}
    >
      <Heart size={20} fill={isFavorited ? 'currentColor' : 'none'} />
    </button>
  );

  return (
    <>
      <Navbar title="Listing details" actions={shareButton} hideTabs />

      {showOfferModal && (
        <Sheet title={<><Tag size={20} color="var(--primary-text)" /> Make an offer</>} labelId="offer-title" onClose={() => { setShowOfferModal(false); setOfferError(''); }}>
          <p className="secondary" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
            Listed at <strong style={{ color: 'var(--text-primary)' }}>{formatPrice(listing.price)}</strong>. Your offer goes straight to {sellerFirstName} in the chat.
          </p>
          <form onSubmit={handleSubmitOffer} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label htmlFor="offer-amount-input" className="field-label">Your offer</label>
              <div className="price-input">
                <span className="cur" aria-hidden="true">₹</span>
                <input
                  id="offer-amount-input"
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  required
                />
              </div>
              {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                <div style={{ fontSize: '0.78rem', color: parseFloat(offerAmount) < listing.price ? 'var(--warning)' : 'var(--success)', marginTop: '6px' }}>
                  {Math.round(Math.abs(1 - parseFloat(offerAmount) / listing.price) * 100)}%
                  {parseFloat(offerAmount) < listing.price ? ' below' : ' above'} asking price
                </div>
              )}
            </div>
            <div>
              <label htmlFor="offer-message-input" className="field-label">Message to seller <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
              <textarea
                id="offer-message-input"
                className="input"
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                placeholder="e.g. I can pick it up today"
                rows={3}
              />
            </div>
            {offerError && <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)' }}>{offerError}</div>}
            <button type="submit" id="offer-submit-btn" disabled={submittingOffer} className="btn-primary btn-lg btn-block">
              {submittingOffer ? 'Sending offer…' : 'Send offer'}
            </button>
          </form>
        </Sheet>
      )}

      <main className="page pd-page">
        <Link to="/browse" className="btn btn-ghost btn-sm desktop-only" style={{ marginBottom: '12px', marginLeft: '-8px' }}>
          <ArrowLeft size={16} /> Back to Explore
        </Link>

        <div className="pd-layout">
          <div className="pd-main">
            {/* Gallery */}
            <div className="pd-gallery-block" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="gallery">
                {!activeMedia ? (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}><ImageIcon size={40} /></div>
                ) : activeMedia.mediaType === 'VIDEO' ? (
                  <video key={activeMedia.id} src={activeMedia.url} controls playsInline preload="metadata" />
                ) : (
                  <img src={activeMedia.url} alt={listing.title} />
                )}
                {mediaCount > 0 && activeMedia?.mediaType !== 'VIDEO' && (
                  <span className="g-count chip chip-photo chip-upper" style={{ padding: '5px 10px' }}>
                    <ImageIcon size={13} /> Photo {images.slice(0, activeIdx + 1).filter((m) => m.mediaType !== 'VIDEO').length} of {photoCount}
                  </span>
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

            {/* Specs + description */}
            <div className="pd-details-block" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <section aria-labelledby="pd-specs">
                <h2 id="pd-specs" className="section-title" style={{ marginBottom: '10px' }}>Item details</h2>
                <div className="spec-grid">
                  <div className="spec-card">
                    <div className="spec-label">Condition</div>
                    <div className="spec-value">{CONDITION_LABELS[listing.condition] ?? listing.condition}</div>
                  </div>
                  {specs.map((attr) => (
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

              <section className="card card-pad" aria-labelledby="pd-desc">
                <h2 id="pd-desc" className="section-title" style={{ fontSize: '1rem', marginBottom: '8px' }}>Description</h2>
                <p className="secondary" style={{ lineHeight: 1.65, whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{listing.description}</p>
              </section>
            </div>
          </div>

          <div className="pd-side">
            {/* Summary: verification, title, price, actions */}
            <div className="pd-summary-block" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {listing.verifiedAt && (
                <div className="verified-banner">
                  <span className="vb-icon"><BadgeCheck size={20} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="overline" style={{ color: 'var(--success)', fontWeight: 700 }}>Staff-verified listing</div>
                    <div className="secondary" style={{ fontSize: '0.84rem' }}>Checked by the Becho team</div>
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <Chip upper square>{listing.category?.name || 'General'}</Chip>
                  {brand && <Chip upper square tone="primary">{attrValue(brand)}</Chip>}
                </div>
                <h1 style={{ fontSize: '1.45rem', fontWeight: 700, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{listing.title}</h1>
                <div className="muted" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 12px', fontSize: '0.84rem', marginTop: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {cityName}, {stateName}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> Posted {timeAgo(listing.createdAt)}</span>
                </div>
              </div>

              <div className="card card-pad">
                <div className="price" style={{ fontSize: '1.9rem', lineHeight: 1.1 }}>{formatPrice(listing.price)}</div>
                {listing.status === 'LIVE' ? (
                  <div className="muted" style={{ fontSize: '0.82rem', marginTop: '4px' }}>{isSeller ? 'Your asking price' : 'Asking price · make an offer to negotiate'}</div>
                ) : (
                  <div style={{ marginTop: '8px', fontWeight: 600, fontSize: '0.88rem', color: LISTING_STATUS_LABELS[listing.status]?.color ?? 'var(--text-secondary)' }}>
                    {listing.status === 'RESERVED' ? 'Reserved — the seller has accepted an offer' : listing.status === 'SOLD' ? 'This item has been sold' : `Status: ${LISTING_STATUS_LABELS[listing.status]?.label ?? listing.status}`}
                  </div>
                )}

                {existingOffer && !isSeller && (
                  <div className={`remark-box ${existingOffer.status === 'ACCEPTED' ? 'info' : existingOffer.status === 'REJECTED' ? 'danger' : 'warn'}`} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {existingOffer.proposedById === user?.id ? 'Your offer' : 'Seller counter-offer'}: {formatPrice(existingOffer.amount)}
                    </span>
                    <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                      <Chip tone={OFFER_TONES[existingOffer.status] ?? 'neutral'} upper>{existingOffer.status}</Chip>
                      {offerPending && (
                        <button id="cancel-offer-btn" type="button" onClick={handleCancelOffer} className="link" style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>Cancel offer</button>
                      )}
                    </span>
                  </div>
                )}

                {isSeller ? (
                  <div className="info-strip" style={{ margin: '14px 0 0' }}>
                    <Info size={16} /> This is your listing. <Link to="/my-listings" className="link">Manage it</Link>
                  </div>
                ) : (
                  <div className="action-bar sticky-mobile" style={{ marginTop: '14px' }}>
                    {favButton()}
                    {canOffer && (
                      <button
                        id="make-offer-btn"
                        type="button"
                        className="btn btn-outline"
                        onClick={() => { if (!user) { navigate('/login'); return; } setShowOfferModal(true); }}
                        disabled={offerPending}
                        style={{ flex: '0 1 auto', paddingInline: '14px' }}
                      >
                        {offerPending ? 'Offer pending' : existingOffer ? 'New offer' : 'Make offer'}
                      </button>
                    )}
                    <button
                      id="contact-seller-btn"
                      type="button"
                      onClick={handleContactSeller}
                      disabled={contacting}
                      className="btn-primary"
                      style={{ flex: 1, minWidth: 0 }}
                    >
                      <MessageCircle size={18} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{contacting ? 'Connecting…' : `Chat with ${sellerFirstName}`}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Seller */}
            <section className="pd-seller-block card card-pad" aria-labelledby="pd-seller">
              <h2 id="pd-seller" className="section-title" style={{ fontSize: '1rem', marginBottom: '12px' }}>About the seller</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar name={listing.seller.displayName} size="md" />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.02rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.seller.displayName}</span>
                    {listing.seller.status === 'ACTIVE' && <BadgeCheck size={18} color="var(--success)" aria-label="Verified account" />}
                  </div>
                  {listing.seller.status === 'ACTIVE' && <div className="muted" style={{ fontSize: '0.8rem' }}>Verified account</div>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginTop: '14px' }}>
                <div className="kv-tile">
                  <CalendarDays size={18} color="var(--primary-text)" />
                  <div style={{ minWidth: 0 }}>
                    <div className="overline">Member since</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{new Date(listing.seller.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                  </div>
                </div>
                {listing.seller.userCode && (
                  <div className="kv-tile">
                    <Hash size={18} color="var(--primary-text)" />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="overline">Seller ID</div>
                      <code style={{ fontSize: '0.86rem', fontWeight: 700 }}>{listing.seller.userCode}</code>
                    </div>
                    <button type="button" onClick={copySellerCode} className="link" aria-label="Copy seller ID" style={{ fontSize: '0.75rem', display: 'inline-flex', gap: '3px', alignItems: 'center', textTransform: 'uppercase' }}>
                      {copiedCode ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
};
