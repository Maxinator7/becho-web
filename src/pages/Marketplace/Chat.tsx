import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { MessageSquare, Send, CheckCheck, Tag, TrendingDown, CheckCircle, XCircle, RotateCcw, X } from 'lucide-react';

interface ConversationItem {
  id: string;
  listingId: string;
  lastMessageAt: string;
  listing: { id: string; title: string; price: number; status: string; media: { url: string }[] };
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
  messages: { content: string; createdAt: string; isRead: boolean }[];
}

interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; displayName: string };
}

interface Offer {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: string;
  message?: string;
  createdAt: string;
  buyer: { id: string; displayName: string };
  seller: { id: string; displayName: string };
  listing: { id: string; title: string; price: number };
  parentOffer?: { id: string; amount: number; status: string } | null;
  counterOffers?: { id: string; amount: number; status: string; createdAt: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ACCEPTED: '#22c55e',
  REJECTED: '#ef4444',
  COUNTERED: '#818cf8',
  CANCELLED: '#6b7280',
  EXPIRED: '#6b7280',
};

export const Chat: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialConversationId = searchParams.get('conversationId');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Offer state
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showOfferPanel, setShowOfferPanel] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterTargetOffer, setCounterTargetOffer] = useState<Offer | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [counterError, setCounterError] = useState('');
  const [actingOnOffer, setActingOnOffer] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const loadConversations = async () => {
    const res = await fetchApi<ConversationItem[]>('/conversations');
    if (res.success && res.data) {
      setConversations(res.data);
      if (!activeConversationId && res.data.length > 0) setActiveConversationId(res.data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadMessages = async (convId: string) => {
    const res = await fetchApi<{ conversation: ConversationItem; messages: MessageItem[] }>(`/conversations/${convId}/messages`);
    if (res.success && res.data) {
      setActiveConversation(res.data.conversation);
      setMessages(res.data.messages);
      fetchApi(`/conversations/${convId}/read`, { method: 'PATCH' });
    }
  };

  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId);
      const interval = setInterval(() => loadMessages(activeConversationId), 4000);
      return () => clearInterval(interval);
    }
  }, [activeConversationId]);

  // Load offers for the active conversation's listing
  useEffect(() => {
    if (!activeConversation || !user) return;
    const isSeller = activeConversation.seller.id === user.id;
    const endpoint = isSeller
      ? `/offers/listing/${activeConversation.listingId}`
      : `/offers/chain?listingId=${activeConversation.listingId}&buyerId=${activeConversation.buyer.id}`;

    fetchApi<Offer[]>(endpoint).then((res) => {
      if (res.success && res.data) setOffers(res.data);
    });
  }, [activeConversation, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    const res = await fetchApi<MessageItem>(`/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    setSending(false);
    if (res.success && res.data) {
      setMessages((prev) => [...prev, res.data!]);
      loadConversations();
    }
  };

  const handleOfferAction = async (offerId: string, action: 'accept' | 'reject' | 'cancel') => {
    setActingOnOffer(offerId);
    const res = await fetchApi<Offer>(`/offers/${offerId}/${action}`, { method: 'POST' });
    setActingOnOffer(null);
    if (res.success && res.data) {
      setOffers((prev) => prev.map((o) => (o.id === offerId ? res.data! : o)));
    }
  };

  const handleOpenCounter = (offer: Offer) => {
    setCounterTargetOffer(offer);
    setCounterAmount(String(Math.round(offer.amount * 1.05)));
    setCounterError('');
    setShowCounterModal(true);
  };

  const handleSubmitCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterTargetOffer) return;
    const amount = parseFloat(counterAmount);
    if (isNaN(amount) || amount <= 0) { setCounterError('Enter a valid amount.'); return; }
    setActingOnOffer(counterTargetOffer.id);
    const res = await fetchApi<Offer>(`/offers/${counterTargetOffer.id}/counter`, {
      method: 'POST',
      body: JSON.stringify({ amount, message: counterMessage || undefined }),
    });
    setActingOnOffer(null);
    if (res.success && res.data) {
      setOffers((prev) => [res.data!, ...prev.map((o) => o.id === counterTargetOffer.id ? { ...o, status: 'COUNTERED' } : o)]);
      setShowCounterModal(false);
      setCounterTargetOffer(null);
    } else {
      setCounterError(res.error?.message || 'Failed to counter offer.');
    }
  };

  const pendingOffers = offers.filter((o) => o.status === 'PENDING');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Navbar />

      {/* Counter Offer Modal */}
      {showCounterModal && counterTargetOffer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2rem', borderRadius: '20px', position: 'relative' }}>
            <button onClick={() => { setShowCounterModal(false); setCounterError(''); }} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <X size={22} />
            </button>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} color="var(--accent-primary)" /> Counter Offer
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Their offer: <strong style={{ color: '#f59e0b' }}>${counterTargetOffer.amount.toLocaleString()}</strong>
            </p>
            <form onSubmit={handleSubmitCounter} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Your Counter Amount ($)</label>
                <input
                  id="counter-amount-input"
                  type="number" min="1" step="0.01"
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '1.05rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>Message (optional)</label>
                <textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  placeholder="e.g. Best I can do..."
                  rows={2}
                  style={{ width: '100%', padding: '0.7rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: '0.9rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {counterError && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{counterError}</div>}
              <button
                id="counter-submit-btn"
                type="submit"
                disabled={!!actingOnOffer}
                className="btn-primary"
                style={{ padding: '0.8rem', fontWeight: 700, opacity: actingOnOffer ? 0.7 : 1 }}
              >
                {actingOnOffer ? 'Sending...' : 'Send Counter Offer'}
              </button>
            </form>
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <MessageSquare color="var(--accent-primary)" /> Buyer-Seller Messages
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', height: '650px' }}>
        {/* Left: Conversation List */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRadius: '16px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Conversations ({conversations.length})
          </h3>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No messages yet. Browse listings to contact sellers!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {conversations.map((conv) => {
                const otherUser = conv.buyer.id === user?.id ? conv.seller : conv.buyer;
                const lastMsg = conv.messages && conv.messages.length > 0 ? conv.messages[0].content : 'Conversation started';
                const isSelected = activeConversationId === conv.id;
                const thumb = conv.listing.media && conv.listing.media.length > 0 ? conv.listing.media[0].url : undefined;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    style={{
                      padding: '0.85rem', borderRadius: '12px',
                      background: isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)',
                      border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.05)',
                      cursor: 'pointer', display: 'flex', gap: '0.75rem', alignItems: 'center',
                    }}
                  >
                    {thumb ? (
                      <img src={thumb} alt={conv.listing.title} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Tag size={20} color="var(--text-secondary)" />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.listing.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', margin: '0.15rem 0' }}>{otherUser.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastMsg}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Active Thread */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '16px', overflow: 'hidden' }}>
          {activeConversation ? (
            <>
              {/* Header */}
              <div style={{ padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {activeConversation.listing.media && activeConversation.listing.media.length > 0 && (
                    <img src={activeConversation.listing.media[0].url} alt="" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{activeConversation.listing.title}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>${activeConversation.listing.price.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  {pendingOffers.length > 0 && (
                    <button
                      id="offers-panel-btn"
                      onClick={() => setShowOfferPanel(!showOfferPanel)}
                      style={{
                        padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: 700,
                        borderRadius: '20px', border: '1px solid #f59e0b',
                        background: 'rgba(245,158,11,0.12)', color: '#f59e0b', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                      }}
                    >
                      <TrendingDown size={14} /> {pendingOffers.length} Pending Offer{pendingOffers.length > 1 ? 's' : ''}
                    </button>
                  )}
                  <button onClick={() => navigate(`/listings/${activeConversation.listing.id}`)} className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                    View Listing
                  </button>
                </div>
              </div>

              {/* Offer Panel */}
              {showOfferPanel && (
                <div style={{ padding: '1rem 1.5rem', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <TrendingDown size={14} /> Negotiation
                    </h4>
                    <button onClick={() => setShowOfferPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {offers.map((offer) => {
                      const isMine = offer.buyerId === user?.id;
                      const iAmSeller = offer.sellerId === user?.id;
                      const canAct = iAmSeller && offer.status === 'PENDING';
                      const canCancel = isMine && offer.status === 'PENDING';
                      return (
                        <div key={offer.id} style={{ padding: '0.85rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${STATUS_COLORS[offer.status] || 'rgba(255,255,255,0.08)'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: '1rem', color: STATUS_COLORS[offer.status] }}>${offer.amount.toLocaleString()}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.6rem' }}>
                                from {offer.buyer.displayName} · {new Date(offer.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '10px', background: `${STATUS_COLORS[offer.status]}22`, color: STATUS_COLORS[offer.status], fontWeight: 700 }}>
                              {offer.status}
                            </span>
                          </div>
                          {offer.message && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontStyle: 'italic' }}>"{offer.message}"</p>}
                          {offer.parentOffer && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                              ↩ In reply to ${offer.parentOffer.amount.toLocaleString()}
                            </p>
                          )}
                          {(canAct || canCancel) && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                              {canAct && (
                                <>
                                  <button
                                    id={`accept-offer-${offer.id}`}
                                    onClick={() => handleOfferAction(offer.id, 'accept')}
                                    disabled={!!actingOnOffer}
                                    style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'rgba(34,197,94,0.15)', border: '1px solid #22c55e', color: '#22c55e', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                  >
                                    <CheckCircle size={13} /> Accept
                                  </button>
                                  <button
                                    id={`counter-offer-${offer.id}`}
                                    onClick={() => handleOpenCounter(offer)}
                                    disabled={!!actingOnOffer}
                                    style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'rgba(129,140,248,0.15)', border: '1px solid #818cf8', color: '#818cf8', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                  >
                                    <RotateCcw size={13} /> Counter
                                  </button>
                                  <button
                                    id={`reject-offer-${offer.id}`}
                                    onClick={() => handleOfferAction(offer.id, 'reject')}
                                    disabled={!!actingOnOffer}
                                    style={{ flex: 1, padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                                  >
                                    <XCircle size={13} /> Reject
                                  </button>
                                </>
                              )}
                              {canCancel && (
                                <button
                                  onClick={() => handleOfferAction(offer.id, 'cancel')}
                                  disabled={!!actingOnOffer}
                                  style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'rgba(107,114,128,0.15)', border: '1px solid #6b7280', color: '#9ca3af', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Message Thread */}
              <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {messages.map((msg) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ padding: '0.85rem 1.15rem', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? 'linear-gradient(135deg, var(--accent-primary), #4f46e5)' : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.95rem', lineHeight: '1.5' }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', textAlign: isMe ? 'right' : 'left', display: 'flex', alignItems: 'center', justifyContent: isMe ? 'flex-end' : 'flex-start', gap: '0.25rem' }}>
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && <CheckCheck size={12} color={msg.isRead ? 'var(--accent-secondary)' : 'var(--text-secondary)'} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} style={{ padding: '1rem 1.5rem', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontSize: '0.95rem' }}
                />
                <button type="submit" disabled={!newMessage.trim() || sending} className="btn-primary" style={{ borderRadius: '50%', width: '42px', height: '42px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !newMessage.trim() ? 0.5 : 1 }}>
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              Select a conversation to start chatting.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
