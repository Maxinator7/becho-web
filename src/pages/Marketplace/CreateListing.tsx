import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { AlertCircle, MessageSquareWarning, Sparkles, X, Lightbulb, ArrowRight, MapPin, LayoutGrid } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { categoryIcon } from '../../components/ui';
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
  slug?: string;
  children?: CategoryNode[];
}

const CONDITIONS: { value: string; title: string; sub: string }[] = [
  { value: 'NEW', title: 'Brand new', sub: 'Unused, sealed or with tags' },
  { value: 'LIKE_NEW', title: 'Like new', sub: 'Barely used, no marks' },
  { value: 'USED', title: 'Used', sub: 'Normal signs of use' },
  { value: 'REFURBISHED', title: 'Refurbished', sub: 'Restored to working order' },
  { value: 'FOR_PARTS', title: 'For parts', sub: 'Not working or needs repair' },
];
const TITLE_MAX = 120;
const DESCRIPTION_RECOMMENDED = 150;

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

  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitListing('publish');
  };

  /** "Save draft" keeps the listing (or the edits) without sending it for review. */
  const handleSaveDraft = () => {
    if (formRef.current && !formRef.current.reportValidity()) return;
    void submitListing('draft');
  };

  const submitListing = async (mode: 'publish' | 'draft') => {
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
      if (mode === 'draft') {
        setLoading(false);
        navigate('/my-listings', { state: { notice: 'Changes saved. Submit the listing from My listings when you’re ready.' } });
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

    if (createRes.success && createRes.data && mode === 'draft') {
      setLoading(false);
      navigate('/my-listings', { state: { notice: 'Saved as a draft. Publish it from My listings when you’re ready.' } });
      return;
    }

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

  const allChildren = categories.flatMap((parent) => (parent.children ?? []).map((child) => ({ parent, child })));
  const selectedCat = allChildren.find((c) => c.child.id === selectedSubcategoryId);
  const CatIcon = categoryIcon(selectedCat?.parent.slug);
  const requiredAttrsDone = attributes.filter((a) => a.isRequired).every((a) => attributeValues[a.id] !== undefined && attributeValues[a.id] !== '');
  const checks = [
    media.some((m) => m.kind === 'IMAGE' && m.status === 'done'),
    !!selectedSubcategoryId && requiredAttrsDone,
    title.trim().length >= 5,
    parseFloat(price) > 0,
    description.trim().length >= 10,
    !!cityCode,
  ];
  const done = checks.filter(Boolean).length;
  const photoCount = media.filter((m) => m.kind === 'IMAGE').length;
  const videoCount = media.filter((m) => m.kind === 'VIDEO').length;
  const draftLabel = !isEdit || existing?.status === 'DRAFT' ? 'Save draft' : 'Save changes';
  const submitLabel = uploading
    ? 'Uploading media…'
    : loading
      ? (isEdit ? 'Saving…' : 'Submitting…')
      : isEdit
        ? (existing?.status === 'DRAFT' ? 'Save & publish' : 'Save & resubmit')
        : 'Submit & publish';

  const closeButton = (
    <button type="button" className="icon-btn" onClick={() => navigate(isEdit ? '/my-listings' : '/')} aria-label="Close"><X size={22} /></button>
  );

  return (
    <>
      <Navbar title={isEdit ? 'Edit ad' : 'Post ad'} backTo={isEdit ? '/my-listings' : undefined} actions={closeButton} hideTabs />
      <main className="page narrow post-page">
        <div className="card card-pad" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div className="step-head">
              <Sparkles size={16} />
              <span className="overline" style={{ color: 'var(--primary-text)', fontWeight: 700 }}>{isEdit ? 'Edit your ad' : 'Post an ad'}: photos &amp; details</span>
            </div>
            <span className="muted" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{done} of {checks.length} done</span>
          </div>
          <div className="progress" role="progressbar" aria-label="Form completion" aria-valuemin={0} aria-valuemax={checks.length} aria-valuenow={done}>
            <span style={{ width: `${(done / checks.length) * 100}%` }} />
          </div>
        </div>

        {isEdit && loadError && (
          <div role="alert" className="remark-box danger" style={{ color: 'var(--danger)' }}>
            {loadError} <Link to="/my-listings" className="link" style={{ color: 'inherit', textDecoration: 'underline' }}>Back to My listings</Link>
          </div>
        )}
        {isEdit && !loadError && !existing && <p className="muted">Loading your listing…</p>}

        {isEdit && existing && latestReview?.remark && (
          <div className={`remark-box ${existing.status === 'REJECTED' ? 'danger' : 'warn'}`} style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: existing.status === 'REJECTED' ? 'var(--danger)' : 'var(--warning)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              <MessageSquareWarning size={16} /> {existing.status === 'CHANGES_REQUESTED' ? 'Staff remark: please change this' : REVIEW_ACTION_LABELS[latestReview.action] ?? 'Note from Becho'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.92rem' }}>{latestReview.remark}</div>
          </div>
        )}

        {error && (
          <div role="alert" className="remark-box danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '20px' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {(!isEdit || existing) && (
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Photos and video */}
          <section className="form-section" aria-labelledby="post-media">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <h2 id="post-media" className="section-title">Photos &amp; video <span style={{ color: 'var(--danger)' }}>*</span></h2>
              <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{photoCount + videoCount} / {limits.maxImagesPerListing + limits.maxVideosPerListing} items</span>
            </div>
            <MediaUploader items={media} onChange={setMedia} limits={limits} />
            {media.some((m) => m.status === 'error') && (
              <div className="muted" style={{ fontSize: '0.78rem' }}>Files that failed are skipped. Remove them or add them again.</div>
            )}
            <div className="tip-box" style={{ marginTop: '6px' }}>
              <Lightbulb size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span><strong>Tip:</strong> clear, well-lit photos from a few angles get more replies. A short video helps buyers trust what they see.</span>
            </div>
          </section>

          {/* Category */}
          <section className="form-section">
            <label htmlFor="post-category" className="field-label">Category <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="cat-icon" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {selectedCat ? <CatIcon size={20} /> : <LayoutGrid size={20} />}
              </span>
              <select
                id="post-category"
                className="input"
                required
                value={selectedSubcategoryId}
                onChange={(e) => handleSubcategoryChange(e.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    {parent.children?.map((child) => (
                      <option key={child.id} value={child.id}>{child.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {selectedCat && <div className="muted" style={{ fontSize: '0.78rem' }}>{selectedCat.parent.name} › <strong style={{ color: 'var(--primary-text)' }}>{selectedCat.child.name}</strong></div>}
          </section>

          {/* Category attributes */}
          {attributes.length > 0 && (
            <section className="form-grid-2" aria-label="Item details">
              {attributes.map((attr) => (
                <div key={attr.id}>
                  <label htmlFor={`attr-${attr.id}`} className="field-label">
                    {attr.name} {attr.isRequired && <span style={{ color: 'var(--danger)' }}>*</span>}
                  </label>
                  {attr.options && attr.options.length > 0 ? (
                    <select
                      id={`attr-${attr.id}`}
                      className="input"
                      required={attr.isRequired}
                      value={attributeValues[attr.id] || ''}
                      onChange={(e) => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                    >
                      <option value="">Select {attr.name.toLowerCase()}</option>
                      {attr.options.map((opt) => (
                        <option key={opt.id} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`attr-${attr.id}`}
                      className="input"
                      required={attr.isRequired}
                      type={attr.dataType === 'NUMBER' ? 'number' : 'text'}
                      inputMode={attr.dataType === 'NUMBER' ? 'numeric' : undefined}
                      value={attributeValues[attr.id] || ''}
                      onChange={(e) => setAttributeValues({ ...attributeValues, [attr.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </section>
          )}

          {/* Title */}
          <section className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <label htmlFor="post-title" className="field-label">Ad title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <span className="muted" style={{ fontSize: '0.75rem', fontWeight: 600 }} aria-live="polite">{title.length} / {TITLE_MAX}</span>
            </div>
            <input
              id="post-title"
              className="input"
              type="text"
              required
              minLength={5}
              maxLength={TITLE_MAX}
              placeholder="e.g. iPhone 14 Pro 128GB Space Black"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </section>

          {/* Condition */}
          <fieldset className="form-section" style={{ border: 'none' }}>
            <legend className="field-label">Item condition <span style={{ color: 'var(--danger)' }}>*</span></legend>
            <div className="form-grid-2" style={{ gap: '8px' }}>
              {CONDITIONS.map((c) => (
                <label key={c.value} className="radio-card">
                  <input type="radio" name="condition" value={c.value} checked={condition === c.value} onChange={() => setCondition(c.value)} />
                  <span className="dot" aria-hidden="true" />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem' }}>{c.title}</span>
                    <span className="muted" style={{ display: 'block', fontSize: '0.74rem' }}>{c.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Price */}
          <section className="form-section">
            <label htmlFor="post-price" className="field-label">Price <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div className="price-input">
              <span className="cur" aria-hidden="true">₹</span>
              <input
                id="post-price"
                type="number"
                required
                min="1"
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Buyers can send you offers in the chat.</div>
          </section>

          {/* City */}
          <section className="form-section">
            <label htmlFor="post-city" className="field-label">Item location <span style={{ color: 'var(--danger)' }}>*</span></label>
            <div style={{ position: 'relative' }}>
              <MapPin size={18} color="var(--primary-text)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <select
                id="post-city"
                className="input"
                required
                value={cityCode}
                onChange={(e) => setCityCode(e.target.value)}
                style={{ paddingLeft: '38px' }}
              >
                {sellingAreas.length === 0 && <option value="">No cities available</option>}
                {sellingAreas.map((a) => (
                  <option key={a.id} value={a.cityCode}>{a.cityName}, {a.stateName}</option>
                ))}
              </select>
            </div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>Only the city is shown to buyers.</div>
          </section>

          {/* Description */}
          <section className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
              <label htmlFor="post-description" className="field-label">Description <span style={{ color: 'var(--danger)' }}>*</span></label>
              <span className="muted" style={{ fontSize: '0.74rem', fontWeight: 600, color: description.trim().length >= DESCRIPTION_RECOMMENDED ? 'var(--success)' : undefined }}>
                {description.trim().length >= DESCRIPTION_RECOMMENDED ? `${description.trim().length} chars` : `Recommended: ${DESCRIPTION_RECOMMENDED}+ chars`}
              </span>
            </div>
            <textarea
              id="post-description"
              className="input"
              required
              minLength={10}
              maxLength={5000}
              rows={6}
              placeholder="Condition, what's included (box, bill, charger), how long you've used it and why you're selling…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </section>

          {!isEdit && (
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              You can post up to {limits.listingsPerDay} listings a day. New listings are screened before they go live.
            </div>
          )}

          <div className="sticky-footer">
            <button type="button" className="btn btn-outline btn-lg" onClick={handleSaveDraft} disabled={loading || uploading} style={{ flexShrink: 0 }}>
              {draftLabel}
            </button>
            <button type="submit" disabled={loading || uploading} className="btn-primary btn-lg" style={{ flex: 1, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{submitLabel}</span> {!loading && !uploading && <ArrowRight size={18} />}
            </button>
          </div>
        </form>
        )}
      </main>
    </>
  );
};
