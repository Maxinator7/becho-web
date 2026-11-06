import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

export interface ServiceArea {
  id: string;
  countryCode: string;
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  isActive: boolean;
  buyingEnabled: boolean;
  sellingEnabled: boolean;
}

export const LocationSelector: React.FC = () => {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('New York City');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [availability, setAvailability] = useState<{ isServed: boolean; buyingEnabled: boolean; sellingEnabled: boolean } | null>(null);

  useEffect(() => {
    fetchApi<ServiceArea[]>('/locations/service-areas').then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setAreas(res.data);
        const first = res.data[0];
        checkAvailability(first.countryCode, first.stateCode, first.cityName);
      }
    });
  }, []);

  const checkAvailability = (countryCode: string, stateCode: string, cityName: string) => {
    fetchApi<any>(`/locations/availability?countryCode=${countryCode}&stateCode=${stateCode}&cityName=${cityName}`).then((res) => {
      if (res.success && res.data) {
        setAvailability(res.data);
      }
    });
  };

  const handleSelect = (area: ServiceArea) => {
    setSelectedCity(area.cityName);
    checkAvailability(area.countryCode, area.stateCode, area.cityName);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid var(--accent-primary)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <MapPin size={16} color="var(--accent-primary)" />
        <span>{selectedCity}</span>
      </button>

      {isOpen && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: '110%',
            right: 0,
            width: '280px',
            padding: '1rem',
            zIndex: 100,
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Select Service Area</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {areas.map((area) => (
              <button
                key={area.id}
                onClick={() => handleSelect(area)}
                style={{
                  textAlign: 'left',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: selectedCity === area.cityName ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{area.cityName}, {area.stateCode}</span>
                {area.buyingEnabled && area.sellingEnabled ? (
                  <CheckCircle size={14} color="#10b981" />
                ) : (
                  <AlertTriangle size={14} color="#f59e0b" />
                )}
              </button>
            ))}
          </div>

          {availability && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div>Buying: {availability.buyingEnabled ? '✅ Active' : '❌ Disabled'}</div>
              <div>Selling: {availability.sellingEnabled ? '✅ Active' : '❌ Disabled'}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
