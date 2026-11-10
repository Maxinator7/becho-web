import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';
import { PlusCircle, Upload, AlertCircle } from 'lucide-react';

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
  const [imageUrl, setImageUrl] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApi<CategoryNode[]>('/categories').then((res) => {
      if (res.success && res.data) {
        setCategories(res.data);
      }
    });
  }, []);

  const handleSubcategoryChange = (subcatId: string) => {
    setSelectedSubcategoryId(subcatId);
    setAttributes([]);
    setAttributeValues({});
    if (!subcatId) return;

    fetchApi<AttributeDefinition[]>(`/categories/${subcatId}/attributes`).then((res) => {
      if (res.success && res.data) {
        setAttributes(res.data);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to create a listing.');
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
      media: imageUrl ? [{ url: imageUrl.trim() }] : [],
    };

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
          <PlusCircle color="var(--accent-primary)" /> Post a New Listing
        </h2>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

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
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Condition *</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#1e1e2d', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: '#1e1e2d', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
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
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
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
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo / Media URL */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Photo URL (Image link)
            </label>
            <input
              type="url"
              placeholder="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontSize: '1rem' }}>
            <Upload size={18} /> {loading ? 'Submitting Listing...' : 'Publish Listing'}
          </button>
        </form>
      </div>
    </div>
  );
};
