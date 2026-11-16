import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, Bike, Car, Heart, LayoutGrid, Laptop, MapPin, Shirt, Smartphone, Sofa, Tag, X,
} from 'lucide-react';
import { fetchApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import {
  CONDITION_LABELS, LISTING_STATUS_LABELS, LISTING_STATUS_TONES, StatusTone, formatPrice, timeAgo,
} from '../utils/format';

/* Small building blocks shared by the marketplace screens. Styling lives in index.css. */

export const Avatar: React.FC<{ name?: string | null; size?: 'sm' | 'md' | 'lg'; style?: React.CSSProperties }> = ({ name, size = 'sm', style }) => (
  <span className={`avatar${size === 'sm' ? '' : ` ${size}`}`} aria-hidden="true" style={style}>
    {(name || '?').trim().charAt(0)}
  </span>
);

export const Chip: React.FC<{ tone?: StatusTone; upper?: boolean; square?: boolean; className?: string; style?: React.CSSProperties; title?: string; children: React.ReactNode }> = ({
  tone = 'neutral', upper, square, className, style, title, children,
}) => (
  <span title={title} className={`chip chip-${tone}${upper ? ' chip-upper' : ''}${square ? ' chip-square' : ''}${className ? ` ${className}` : ''}`} style={style}>
    {children}
  </span>
);

/** Listing status as an uppercase chip ("LIVE & VERIFIED", "UNDER REVIEW", …). */
export const StatusChip: React.FC<{ status: string; verified?: boolean }> = ({ status, verified }) => {
  const label = status === 'LIVE' && verified ? 'Live & verified' : LISTING_STATUS_LABELS[status]?.label ?? status;
  return (
    <Chip tone={LISTING_STATUS_TONES[status] ?? 'neutral'} upper>
      {status === 'LIVE' && verified && <BadgeCheck size={12} />}
      {label}
    </Chip>
  );
};

/** Green "VERIFIED" chip for staff-verified listings (listing.verifiedAt). */
export const VerifiedChip: React.FC<{ onPhoto?: boolean }> = ({ onPhoto }) => (
  <span className={`chip chip-upper ${onPhoto ? 'chip-solid-success' : 'chip-success'}`} title="Checked by the Becho team">
    <BadgeCheck size={12} /> Verified
  </span>
);

/** Icon for a top-level category slug (falls back to a generic grid). */
export const CATEGORY_ICONS: Record<string, typeof Tag> = {
  mobiles: Smartphone,
  'mobile-phones': Smartphone,
  electronics: Laptop,
  laptops: Laptop,
  vehicles: Bike,
  cars: Car,
  bikes: Bike,
  furniture: Sofa,
  fashion: Shirt,
};
export const categoryIcon = (slug?: string) => (slug && CATEGORY_ICONS[slug]) || LayoutGrid;

/** Short label for a category tile ("Electronics & Appliances" → "Electronics"). */
export const shortCategoryName = (name: string) => name.split(/\s*&\s*|,\s*/)[0];

/* ───────────── categories ───────────── */

export interface CategoryNode { id: string; name: string; slug: string; parentId?: string | null; children?: CategoryNode[] }

let categoryCache: Promise<CategoryNode[]> | null = null;

/** Top-level categories with their subcategories (fetched once per page load). */
export function useCategories() {
  const [cats, setCats] = useState<CategoryNode[]>([]);
  useEffect(() => {
    if (!categoryCache) {
      categoryCache = fetchApi<CategoryNode[]>('/categories').then((res) => {
        if (res.success && res.data) return res.data;
        categoryCache = null;
        return [];
      });
    }
    let live = true;
    categoryCache.then((c) => { if (live) setCats(c); });
    return () => { live = false; };
  }, []);
  return cats;
}

/* ───────────── favourites ───────────── */

/**
 * The signed-in user's saved listing ids, with a toggle. Signed-out users are sent to sign in.
 * Each grid mounts its own copy; the list is small.
 */
export function useFavoriteIds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    fetchApi<{ id: string }[]>('/favorites').then((res) => {
      if (res.success && res.data) setIds(new Set(res.data.map((l) => l.id)));
    });
  }, [user]);

  const toggle = useCallback(async (listingId: string) => {
    if (!user) { navigate('/login', { state: { from: window.location.pathname + window.location.search } }); return; }
    const res = await fetchApi<{ favorited: boolean }>(`/favorites/${listingId}`, { method: 'POST' });
    if (res.success && res.data) {
      const on = res.data.favorited;
      setIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(listingId); else next.delete(listingId);
        return next;
      });
    }
  }, [user, navigate]);

  return { ids, toggle };
}

/* ───────────── listing card ───────────── */

export interface ListingCardData {
  id: string;
  title: string;
  price: number | string;
  condition: string;
  cityCode: string;
  createdAt?: string;
  verifiedAt?: string | null;
  category?: { name: string } | null;
  media?: { url: string; mediaType?: string }[];
}

export const ListingCard: React.FC<{
  item: ListingCardData;
  favorited?: boolean;
  onToggleFavorite?: (id: string) => void;
}> = ({ item, favorited, onToggleFavorite }) => {
  const { areas } = useLocation();
  const city = areas.find((a) => a.cityCode === item.cityCode)?.cityName ?? item.cityCode;
  const photo = item.media?.find((m) => m.mediaType !== 'VIDEO')?.url ?? item.media?.[0]?.url;
  return (
    <Link to={`/listings/${item.id}`} className="lcard">
      <div className="lcard-media">
        {photo ? (
          <img src={photo} alt="" loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Tag size={28} />
          </div>
        )}
        <span className="bl cond-tag">{CONDITION_LABELS[item.condition] ?? item.condition}</span>
        {onToggleFavorite && (
          <button
            type="button"
            className={`heart${favorited ? ' on' : ''}`}
            aria-label={favorited ? 'Remove from saved' : 'Save'}
            aria-pressed={!!favorited}
            title={favorited ? 'Remove from saved' : 'Save'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(item.id); }}
          >
            <Heart size={16} fill={favorited ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
      <div className="lcard-body">
        {item.verifiedAt && <span className="vchip"><BadgeCheck size={13} /> Verified by Becho</span>}
        <div className="lcard-title" title={item.title}>{item.title}</div>
        {item.category?.name && <div className="lcard-sub">{item.category.name}</div>}
        <div className="price lcard-price">{formatPrice(Number(item.price))}</div>
        <div className="lcard-meta">
          <span><MapPin size={12} style={{ flexShrink: 0 }} /> {city}</span>
          {item.createdAt && <span style={{ flexShrink: 0 }}>{timeAgo(item.createdAt)}</span>}
        </div>
      </div>
    </Link>
  );
};

/** "Verified by Becho" chip for staff-verified listings. */
export const VerifiedByBecho: React.FC<{ small?: boolean }> = ({ small }) => (
  <span className={`vchip${small ? ' sm' : ''}`} title="Checked by the Becho team"><BadgeCheck size={small ? 12 : 13} /> Verified by Becho</span>
);

/* ───────────── modal / bottom sheet ───────────── */

export const Sheet: React.FC<{ title: React.ReactNode; onClose: () => void; children: React.ReactNode; labelId?: string }> = ({ title, onClose, children, labelId = 'sheet-title' }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
          <h2 id={labelId} className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
};

/** Centered loading / empty message inside a card. */
export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }> = ({ icon, title, children, action }) => (
  <div className="card empty-state">
    {icon && <div className="empty-icon">{icon}</div>}
    <h3 className="section-title" style={{ marginBottom: '6px' }}>{title}</h3>
    {children && <p className="secondary" style={{ fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>{children}</p>}
    {action && <div style={{ marginTop: '18px' }}>{action}</div>}
  </div>
);
