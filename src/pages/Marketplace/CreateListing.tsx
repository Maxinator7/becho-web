import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { PlusCircle, Upload, AlertCircle, Pencil, MessageSquareWarning } from 'lucide-react';
import { MediaItem, MediaUploader } from '../../components/MediaUploader';
import { DEFAULT_LIMITS, MediaLimits, getMediaLimits } from '../../utils/media';
import { EDITABLE_LISTING_STATUSES, LISTING_STATUS_LABELS, REVIEW_ACTION_LABELS } from '../../utils/format';

/** Shape of GET /listings/:id used to pre-fill the form in edit mode. */
interface ExistingListing {
  id: string;
  title: string;
  description: string;
  price: number | string;
  condition: string;
  status: string;
  cityCode: string;
  categoryId: string;
  seller: { id: string };
  attributes: { attributeDefinitionId: string; valueText?: string | null; valueNumber?: number | string | null; valueBoolean?: boolean | null }[];
  media: { id: string; url: string; mediaType?: string }[];
}

interface Review { id: string; action: string; remark: string | null; createdAt: string }

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

interface AttributeOption {
  id: string;
  label: string;
  value: string;
}

interface AttributeDefinition {
  id: string;
  name: string;
  dataType: string;
  isRequired: boolean;
  options: AttributeOption[];
}

export const CreateListing: React.FC = () => {
  // /listings/:id/edit reuses this form: it pre-fills from the listing, then PATCHes and resubmits.
  const { id: listingId } = useParams<{ id: string }>();
  const isEdit = !!listingId;
  const { user } = useAuth();
  const navigate = useNavigate();
  const { areas, selectedArea } = useLocation();
  const sellingAreas = areas.filter((a) => a.sellingEnabled);
  const [cityCode, setCityCode] = useState<string>('');
  // Default the listing location to the city chosen in the navbar.
  useEffect(() => {
    if (cityCode || sellingAreas.length === 0) return;
    const preferred = sellingAreas.find((a) => a.cityCode === selectedArea?.cityCode) ?? sellingAreas[0];
    setCityCode(preferred.cityCode);
  }, [sellingAreas, selectedArea, cityCode]);

  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>({});

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('USED');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [limits, setLimits] = useState<MediaLimits>(DEFAULT_LIMITS);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit mode
  const [existing, setExisting] = useState<ExistingListing | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestReview, setLatestReview] = useState<Review | null>(null);

  useEffect(() => {
    if (!listingId || !user) return;
    let cancelled = false;
    (async () => {
      const res = await fetchApi<ExistingListing>(`/listings/${listingId}`);
      if (cancelled) return;
      if (!res.success || !res.data) {
        setLoadError(res.error?.message || 'Could not load this listing.');
        return;
      }
      const l = res.data;
      if (l.seller.id !== user.id) {
        setLoadError('You can only edit your own listings.');
        return;
      }
      if (!EDITABLE_LISTING_STATUSES.includes(l.status)) {
        setLoadError(`This listing is ${LISTING_STATUS_LABELS[l.status]?.label.toLowerCase() ?? l.status} and can’t be edited right now.`);
        return;
      }
      setExisting(l);
      setTitle(l.title);
      setDescription(l.description);
      setPrice(String(Number(l.price)));
      setCondition(l.condition);
      setCityCode(l.cityCode);
      setMedia(
        l.media.map((m) => ({
          key: `existing-${m.id}`,
          kind: m.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
          previewUrl: m.url,
          status: 'done',
          progress: 1,
          mediaId: m.id,
        }))
      );
      const initialValues: Record<string, any> = {};
      for (const a of l.attributes) {
        const v = a.valueText ?? (a.valueNumber !== null && a.valueNumber !== undefined ? String(Number(a.valueNumber)) : a.valueBoolean ?? undefined);
        if (v !== undefined && v !== null) initialValues[a.attributeDefinitionId] = v;
      }
      handleSubcategoryChange(l.categoryId, initialValues);

      const reviews = await fetchApi<Review[]>(`/listings/${listingId}/reviews`);
      if (!cancelled && reviews.success && reviews.data?.length) setLatestReview(reviews.data[0]);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId, user?.id]);

  useEffect(() => {
    fetchApi<CategoryNode[]>('/categories').then((res) => {
      if (res.success && res.data) {
        setCategories(res.data);
      }
    });
  }, []);

  const handleSubcategoryChange = (subcatId: string, initialValues: Record<string, any> = {}) => {
    setSelectedSubcategoryId(subcatId);
    setAttributes([]);
    setAttributeValues(initialValues);
    if (!subcatId) return;

    fetchApi<AttributeDefinition[]>(`/categories/${subcatId}/attributes`).then((res) => {
      if (res.success && res.data) {
        setAttributes(res.data);
      }
    });
  };

  useEffect(() => {
    getMediaLimits().then(setLimits);
  }, []);

  const uploading = media.some((m) => m.status === 'uploading');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to create a listing.');
      return;
    }
    if (uploading) {
      setError('Please wait for your photos and video to finish uploading.');
      return;
    }
    if (!media.some((m) => m.kind === 'IMAGE' && m.status === 'done')) {
      setError('Add at least one photo — listings with photos get far more replies.');
      return;
    }

    setError(null);
    setLoading(true);

    const area = sellingAreas.find((a) => a.cityCode === cityCode);
    if (!area) {
      setLoading(false);
      setError('Please choose the city where the item is located.');
      return;
    }

    const attrArray = attributes
      .filter((attr) => attributeValues[attr.id] !== undefined && attributeValues[attr.id] !== '')
      .map((attr) =>
        attr.dataType === 'NUMBER' || attr.dataType === 'CURRENCY'
          ? { attributeDefinitionId: attr.id, valueNumber: Number(attributeValues[attr.id]) }
          : { attributeDefinitionId: attr.id, valueText: String(attributeValues[attr.id]) }
      );

    const body = {
      categoryId: selectedSubcategoryId,
      title,
      description,
      price: parseFloat(price),
      condition,
      countryCode: area.countryCode,
      stateCode: area.stateCode,
      cityCode: area.cityCode,
      attributes: attrArray,
      // Photos first (the first one is the cover shown in search results), then the video.
      media: [...media.filter((m) => m.kind === 'IMAGE'), ...media.filter((m) => m.kind === 'VIDEO')]
        .filter((m) => m.status === 'done' && (m.uploadId || m.mediaId))
        .map((m) => (m.mediaId ? { mediaId: m.mediaId } : { uploadId: m.uploadId! })),
    };

    if (isEdit && existing) {
      const saveRes = await fetchApi<{ id: string }>(`/listings/${existing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      if (!saveRes.success) {
        setLoading(false);
        setError(saveRes.error?.message || 'Could not save your changes.');
        return;
      }
      const submitRes = await fetchApi<{ status: string }>(`/listings/${existing.id}/submit`, { method: 'POST' });
      setLoading(false);
      if (submitRes.success) {
        navigate('/my-listings', {
          state: {
            notice: submitRes.data?.status === 'LIVE'
              ? 'Changes saved — your listing is live again.'
              : 'Changes saved and sent for review. We’ll let you know once it’s approved.',
          },
        });
      } else {
        setError(`Your changes were saved, but the listing could not be resubmitted: ${submitRes.error?.message || 'unknown error'}`);
      }
      return;
    }

    const createRes = await fetchApi<{ id: string }>('/listings', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (createRes.success && createRes.data) {
      // Auto-submit to LIVE state
      const submitRes = await fetchApi<{ status: string }>(`/listings/${createRes.data.id}/submit`, {
        method: 'POST',
      });
      setLoading(false);
      if (submitRes.success) {
        navigate('/my-listings', { state: { notice: submitRes.data?.status === 'PENDING_REVIEW' ? 'Your listing is being reviewed by our team and will go live once approved.' : 'Your listing is live!' } });
      } else {
        setError(`Saved as draft, but could not publish: ${submitRes.error?.message || 'unknown error'}`);
      }
    } else {
      setLoading(false);
      setError(createRes.error?.message || 'Failed to create listing draft.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <nav className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Link to="/" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
          <span className="gradient-text">BECHO</span> Marketplace
        </Link>
        <Link to="/my-listings" style={{ color: 'var(--text-secondary)' }}>My Listings</Link>
      </nav>

      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isEdit ? <><Pencil color="var(--accent-primary)" /> Edit your listing</> : <><PlusCircle color="var(--accent-primary)" /> Post a New Listing</>}
        </h2>

        {isEdit && loadError && (
          <div role="alert" style={{ color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, transparent)', padding: '0.75rem 1rem', borderRadius: '8px' }}>
            {loadError} <Link to="/my-listings" style={{ fontWeight: 700, textDecoration: 'underline' }}>Back to My Listings</Link>
          </div>
        )}
        {isEdit && !loadError && !existing && <p style={{ color: 'var(--text-secondary)' }}>Loading your listing…</p>}

        {isEdit && existing && latestReview?.remark && (
          <div style={{ marginBottom: '1.5rem', padding: '0.85rem 1rem', borderRadius: '10px', color: 'var(--text-primary)', background: 'color-mix(in srgb, var(--warning) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--warning) 35%, transparent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              <MessageSquareWarning size={16} /> {existing.status === 'CHANGES_REQUESTED' ? 'Our team asked for these changes' : REVIEW_ACTION_LABELS[latestReview.action] ?? 'Note from Becho'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.92rem' }}>{latestReview.remark}</div>
          </div>
        )}

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {(!isEdit || existing) && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Category Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Select Subcategory *
            </label>
            <select
              required
              value={selectedSubcategoryId}
              onChange={(e) => handleSubcategoryChange(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--select-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
            >
              <option value="">Select Category</option>
              {categories.map((parent) => (
                <optgroup key={parent.id} label={parent.name}>
                  {parent.children?.map((child) => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Title & Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. iPhone 14 Pro 128GB Space Black"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Price (₹) *</label>
              <input
                type="number"
                required
                step="0.01"
                placeholder="799.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>
          </div>

          {/* Description & Condition */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Description *</label>
              <textarea
                required
                rows={4}
                placeholder="Provide item details, condition notes, and reason for selling..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Condition *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--select-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              >
                <option value="NEW">New</option>
                <option value="LIKE_NEW">Like New</option>
                <option value="USED">Used</option>
                <option value="REFURBISHED">Refurbished</option>
                <option value="FOR_PARTS">For Parts</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>City *</label>
              <select
                required
                value={cityCode}
                onChange={(e) => setCityCode(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--select-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              >
                {sellingAreas.length === 0 && <option value="">No cities available</option>}
                {sellingAreas.map((a) => (
                  <option key={a.id} value={a.cityCode}>{a.cityName}, {a.stateName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic Category Attributes */}
          {attributes.length > 0 && (
            <div style={{ background: 'var(--surface-1)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--accent-secondary)' }}>Category Specifications</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {attributes.map((attr) => (
                  <div key={attr.id}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      {attr.name} {attr.isRequired && '*'}
                    </label>
                    {attr.options && attr.options.length > 0 ? (
                      <select
                        value={attributeValues[attr.id] || ''}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'var(--select-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                      >
                        <option value="">Select {attr.name}</option>
                        {attr.options.map((opt) => (
                          <option key={opt.id} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={attr.dataType === 'NUMBER' ? 'number' : 'text'}
                        value={attributeValues[attr.id] || ''}
                        onChange={(e) => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photos and video */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Photos and video *
            </label>
            <MediaUploader items={media} onChange={setMedia} limits={limits} />
            {media.some((m) => m.status === 'error') && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                Files that failed are skipped. Remove them or add them again.
              </div>
            )}
          </div>

          {!isEdit && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              You can post up to {limits.listingsPerDay} listings a day.
            </div>
          )}

          <button type="submit" disabled={loading || uploading} className="btn-primary" style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '1rem' }}>
            <Upload size={18} /> {uploading ? 'Uploading media…' : loading ? (isEdit ? 'Saving…' : 'Submitting Listing...') : isEdit ? (existing?.status === 'DRAFT' ? 'Save & publish' : 'Save & resubmit') : 'Publish Listing'}
          </button>
        </form>
        )}
      </div>
    </div>
  );
};
