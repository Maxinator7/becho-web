import React, { useEffect, useState } from 'react';
import { Check, MapPin, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { ServiceArea } from '../types';
import { Card, EmptyState, ErrorBanner, Loading, PageHeader, Pill, apiError } from '../ui';

const OnOff: React.FC<{ on: boolean; onLabel?: string; offLabel?: string }> = ({ on, onLabel = 'Enabled', offLabel = 'Disabled' }) => (
  <Pill tone={on ? 'success' : 'danger'} icon={on ? <Check size={12} /> : <X size={12} />}>{on ? onLabel : offLabel}</Pill>
);

export const ServiceAreasPage: React.FC = () => {
  const [areas, setAreas] = useState<ServiceArea[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchApi<ServiceArea[]>('/locations/service-areas').then((res) => {
      if (res.success && res.data) setAreas(res.data);
      else setError(apiError(res, 'Could not load service areas'));
    });
  };
  useEffect(load, []);

  const active = areas?.filter((a) => a.isActive).length ?? 0;

  return (
    <div>
      <PageHeader
        overline="Configuration"
        title="Service areas"
        titleExtra={areas && <span className="a-chip a-chip--pill" style={{ marginTop: 8, background: 'var(--a-surface-3)' }}>{active} of {areas.length} active</span>}
        subtitle="Cities where Becho is open for buying and selling. Read-only here."
      />
      {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} onRetry={load} /></div>}
      <Card flush>
        {!areas && !error ? (
          <Loading />
        ) : areas && areas.length === 0 ? (
          <EmptyState icon={<MapPin size={28} />} title="No service areas configured" />
        ) : (
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>State / country</th>
                  <th>Status</th>
                  <th>Buying</th>
                  <th>Selling</th>
                </tr>
              </thead>
              <tbody>
                {areas?.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="a-row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                        <span className="a-kpi__icon" aria-hidden><MapPin size={15} /></span>
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.cityName}</div>
                          <div className="a-small a-mono a-text-2">{a.cityCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="a-text-2">{a.stateName}, {a.countryCode}</td>
                    <td><OnOff on={a.isActive} onLabel="Active" offLabel="Inactive" /></td>
                    <td><OnOff on={a.buyingEnabled} /></td>
                    <td><OnOff on={a.sellingEnabled} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
