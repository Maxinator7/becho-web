import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { ServiceArea } from '../types';
import { Card, ErrorBanner, Loading, PageHeader, Pill, apiError } from '../ui';

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

  return (
    <div>
      <PageHeader title="Service areas" subtitle={areas ? `${areas.length} cities configured` : 'Cities where Becho is open for buying and selling'} />
      {error && <div style={{ marginBottom: '1rem' }}><ErrorBanner message={error} onRetry={load} /></div>}
      <Card padding="0.5rem 0.75rem 0.75rem">
        {!areas && !error ? (
          <Loading />
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>State / Country</th>
                  <th>Status</th>
                  <th>Buying</th>
                  <th>Selling</th>
                </tr>
              </thead>
              <tbody>
                {areas?.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.cityName} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({a.cityCode})</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{a.stateName}, {a.countryCode}</td>
                    <td><OnOff on={a.isActive} onLabel="Active" /></td>
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
