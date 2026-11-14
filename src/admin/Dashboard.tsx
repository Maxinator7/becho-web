import React, { useEffect, useState } from 'react';
import { Shield, Users, MapPin, AlertTriangle, Check, X } from 'lucide-react';
import { fetchApi } from '../api/client';
import { ServiceArea } from '../components/LocationSelector';

interface FlaggedListing {
  id: string;
  title: string;
  description: string;
  price: number;
  status: string;
  seller?: { displayName: string; email: string };
  category?: { name: string };
  sanitization?: { status: string; score: number; reasons: string[]; checks: any };
}

export const AdminDashboard: React.FC = () => {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [moderationQueue, setModerationQueue] = useState<FlaggedListing[]>([]);
  const [liveListings, setLiveListings] = useState<number | null>(null);

  const loadData = () => {
    fetchApi<ServiceArea[]>('/locations/service-areas').then((res) => {
      if (res.success && res.data) setServiceAreas(res.data);
    });

    fetchApi<{ pagination: { total: number } }>('/listings?limit=1').then((res) => {
      if (res.success && res.data) setLiveListings(res.data.pagination.total);
    });

    fetchApi<FlaggedListing[]>('/admin/moderation/queue').then((res) => {
      if (res.success && res.data) setModerationQueue(res.data);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (id: string) => {
    await fetchApi(`/admin/moderation/listings/${id}/approve`, { method: 'POST' });
    loadData();
  };

  const handleReject = async (id: string) => {
    await fetchApi(`/admin/moderation/listings/${id}/reject`, { method: 'POST' });
    loadData();
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Admin Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Shield size={32} color="var(--accent-primary)" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Moderation Queue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{moderationQueue.length} Pending</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <MapPin size={32} color="var(--accent-secondary)" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Service Areas</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{serviceAreas.length} Active</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Users size={32} color="#ec4899" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Live Listings</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{liveListings ?? '—'}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <AlertTriangle size={32} color="var(--warning)" />
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Flagged Items</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{moderationQueue.length} Items</div>
          </div>
        </div>
      </div>

      {/* Moderation Queue Section */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={20} color="var(--accent-primary)" /> Automated Moderation & Review Queue
        </h3>
        {moderationQueue.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Queue is clear. No flagged or pending review listings.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {moderationQueue.map((item) => (
              <div key={item.id} style={{ background: 'var(--surface-1)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{item.title}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seller: {item.seller?.displayName} ({item.seller?.email})</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)', fontWeight: 600 }}>
                    Score: {item.sanitization?.score ? (item.sanitization.score * 100).toFixed(0) + '%' : '100%'}
                  </span>
                </div>

                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{item.description}</p>

                {item.sanitization?.reasons && item.sanitization.reasons.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    {item.sanitization.reasons.map((r, i) => (
                      <span key={i} style={{ fontSize: '0.75rem', padding: '2px 8px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '4px' }}>
                        ⚠️ {r}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => handleApprove(item.id)} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
                    Approve Listing
                  </button>
                  <button onClick={() => handleReject(item.id)} style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer' }}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Service Areas Management Section */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={20} color="var(--accent-primary)" /> Service Area Marketplace Configuration
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem' }}>City</th>
                <th style={{ padding: '0.75rem' }}>State / Country</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem' }}>Buying Allowed</th>
                <th style={{ padding: '0.75rem' }}>Selling Allowed</th>
              </tr>
            </thead>
            <tbody>
              {serviceAreas.map((area) => (
                <tr key={area.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: 600 }}>{area.cityName} ({area.cityCode})</td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{area.stateName}, {area.countryCode}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: area.isActive ? '#10b981' : '#ef4444' }}>
                      {area.isActive ? <Check size={16} /> : <X size={16} />}
                      {area.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ color: area.buyingEnabled ? '#10b981' : '#ef4444' }}>
                      {area.buyingEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ color: area.sellingEnabled ? '#10b981' : '#ef4444' }}>
                      {area.sellingEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

