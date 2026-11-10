import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { formatPrice, CONDITION_LABELS, LISTING_STATUS_LABELS } from '../../utils/format';
import { Heart, MessageSquare, MapPin, Calendar, ShieldCheck, ArrowLeft, Layers, Tag, X, TrendingDown } from 'lucide-react';

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
  seller: { id: string; displayName: string; createdAt: string };
  category: { id: string; name: string; slug: string };
  attributes: {
    id: string;
    valueText?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    attributeDefinition: { name: string; dataType: string };
  }[];
  media: { id: string; url: string }[];
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

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ACCEPTED: '#22c55e',
  REJECTED: '#ef4444',
  COUNTERED: '#818cf8',
  CANCELLED: '#6b7280',
  EXPIRED: '#6b7280',
};

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
        setOfferAmount(String(Math.floor(res.data.price * 0.9)));
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

  if (loading) return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading product details...</div>
    </div>
  );

  if (errorMsg || !listing) return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Listing Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{errorMsg || 'This listing does not exist or was removed.'}</p>
        <Link to="/browse" className="btn-primary" style={{ padding: '0.6rem 1.25rem', textDecoration: 'none' }}>Back to Browse</Link>
      </div>
    </div>
  );

  const images = listing.media && listing.media.length > 0
    ? listing.media
    : [{ id: 'placeholder', url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800' }];

  const isSeller = user?.id === listing.seller.id;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />

      {/* ── Offer Modal ── */}
      {showOfferModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2rem', borderRadius: '20px', position: 'relative' }}>
            <button
              onClick={() => { setShowOfferModal(false); setOfferError(''); }}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={22} />
            </button>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingDown size={20} color="var(--accent-primary)" /> Make an Offer
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Listed at <strong style={{ color: 'var(--accent-primary)' }}>{formatPrice(listing.price)}</strong>. Your offer goes directly to the seller.
            </p>

            <form onSubmit={handleSubmitOffer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Your Offer Amount (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontWeight: 700 }}>₹</span>
                  <input
                    id="offer-amount-input"
                    type="number"
                    min="1"
                    step="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '0.75rem 1rem 0.75rem 2rem',
                      borderRadius: '10px', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
                      fontSize: '1.1rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {offerAmount && !isNaN(parseFloat(offerAmount)) && (
                  <div style={{ fontSize: '0.75rem', color: parseFloat(offerAmount) < listing.price ? '#f59e0b' : '#22c55e', marginTop: '0.3rem' }}>
                    {Math.round(Math.abs(1 - parseFloat(offerAmount) / listing.price) * 100)}%
                    {parseFloat(offerAmount) < listing.price ? ' below' : ' above'} asking price
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>Message to Seller (optional)</label>
                <textarea
                  id="offer-message-input"
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="e.g. I can pick it up today for cash..."
                  rows={3}
                  style={{
                    width: '100%', padding: '0.75rem 1rem', borderRadius: '10px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#fff', fontSize: '0.95rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {offerError && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
                  {offerError}
                </div>
              )}

              <button
                type="submit"
                id="offer-submit-btn"
                disabled={submittingOffer}
                className="btn-primary"
                style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 700, opacity: submittingOffer ? 0.7 : 1 }}
              >
                {submittingOffer ? 'Sending Offer...' : 'Send Offer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/browse" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.9rem' }}>
          <ArrowLeft size={16} /> Back to Browse
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
        {/* Left Column */}
        <div>
          <div className="glass-panel" style={{ padding: '0.5rem', borderRadius: '16px', overflow: 'hidden', marginBottom: '1rem', background: '#090d16' }}>
            <img src={images[activeMediaIndex].url} alt={listing.title} style={{ width: '100%', height: '420px', objectFit: 'cover', borderRadius: '12px' }} />
          </div>

          {images.length > 1 && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {images.map((media, idx) => (
                <button key={media.id} onClick={() => setActiveMediaIndex(idx)} style={{ border: activeMediaIndex === idx ? '2px solid var(--accent-primary)' : '2px solid transparent', borderRadius: '8px', padding: 0, cursor: 'pointer', background: 'none', overflow: 'hidden' }}>
                  <img src={media.url} alt={`Thumbnail ${idx}`} style={{ width: '70px', height: '70px', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>Description</h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-line' }}>{listing.description}</p>
          </div>

          {listing.attributes && listing.attributes.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.75rem', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--accent-primary)" /> Specifications & Attributes
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {listing.attributes.map((attr) => {
                  const val = attr.valueText || (attr.valueNumber !== undefined ? String(attr.valueNumber) : attr.valueBoolean !== undefined ? (attr.valueBoolean ? 'Yes' : 'No') : 'N/A');
                  return (
                    <div key={attr.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{attr.attributeDefinition.name}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '0.25rem' }}>{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', borderRadius: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', borderRadius: '20px', fontWeight: 600 }}>
                {listing.category?.name || 'General'}
              </span>
              <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)', borderRadius: '20px' }}>
                Condition: {CONDITION_LABELS[listing.condition] ?? listing.condition}
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem', lineHeight: '1.3' }}>{listing.title}</h1>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--accent-primary)', marginBottom: '1.5rem' }}>{formatPrice(listing.price)}</div>
            {listing.status !== 'LIVE' && (
              <div style={{ marginTop: '-1rem', marginBottom: '1.25rem', fontWeight: 700, color: LISTING_STATUS_LABELS[listing.status]?.color ?? 'var(--text-secondary)' }}>
                {listing.status === 'RESERVED' ? 'Reserved — the seller has accepted an offer' : listing.status === 'SOLD' ? 'This item has been sold' : `Status: ${LISTING_STATUS_LABELS[listing.status]?.label ?? listing.status}`}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <MapPin size={16} color="var(--accent-secondary)" /> Location: <strong>{listing.cityCode}, {listing.stateCode}</strong> (Approximate)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Calendar size={16} /> Listed: {new Date(listing.createdAt).toLocaleDateString()}
              </div>
            </div>

            {/* Existing Offer Status Banner */}
            {existingOffer && !isSeller && (
              <div style={{
                padding: '1rem', borderRadius: '10px', marginBottom: '1rem',
                background: `rgba(${existingOffer.status === 'ACCEPTED' ? '34,197,94' : existingOffer.status === 'REJECTED' ? '239,68,68' : '99,102,241'},0.1)`,
                border: `1px solid ${STATUS_COLORS[existingOffer.status] || 'rgba(255,255,255,0.1)'}`,
              }}>
                <div style={{ fontWeight: 700, color: STATUS_COLORS[existingOffer.status], fontSize: '0.95rem', marginBottom: '0.3rem' }}>
                  {existingOffer.proposedById === user?.id ? 'Your offer' : 'Seller counter-offer'}: {formatPrice(existingOffer.amount)} — {existingOffer.status}
                </div>
                {existingOffer.status === 'PENDING' && (
                  <button id="cancel-offer-btn" onClick={handleCancelOffer} style={{ fontSize: '0.78rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Cancel offer
                  </button>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  id="contact-seller-btn"
                  onClick={handleContactSeller}
                  disabled={contacting || isSeller}
                  className="btn-primary"
                  style={{ flex: 1, padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 600, opacity: isSeller ? 0.5 : 1 }}
                >
                  <MessageSquare size={18} /> {isSeller ? 'Your Listing' : contacting ? 'Connecting...' : 'Contact Seller'}
                </button>
                <button
                  onClick={handleToggleFavorite}
                  style={{ padding: '0.85rem', borderRadius: '8px', background: isFavorited ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)', border: isFavorited ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)', color: isFavorited ? '#ef4444' : 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={isFavorited ? 'Remove Favorite' : 'Save Favorite'}
                >
                  <Heart size={20} fill={isFavorited ? '#ef4444' : 'none'} />
                </button>
              </div>

              {!isSeller && listing.status === 'LIVE' && (
                <button
                  id="make-offer-btn"
                  onClick={() => setShowOfferModal(true)}
                  disabled={existingOffer?.status === 'PENDING'}
                  style={{
                    width: '100%', padding: '0.85rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)',
                    color: existingOffer?.status === 'PENDING' ? 'var(--text-secondary)' : 'var(--accent-primary)',
                    cursor: existingOffer?.status === 'PENDING' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <Tag size={16} />
                  {existingOffer?.status === 'PENDING' ? 'Offer Pending...' : existingOffer ? 'Make New Offer' : 'Make an Offer'}
                </button>
              )}
            </div>
          </div>

          {/* Seller Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '16px' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seller Information</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
                {listing.seller.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {listing.seller.displayName} <ShieldCheck size={16} color="var(--accent-secondary)" />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Member since {new Date(listing.seller.createdAt).getFullYear()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
