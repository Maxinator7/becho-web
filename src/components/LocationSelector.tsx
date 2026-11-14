import React, { useState } from 'react';
import { MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { useLocation, ServiceArea } from '../context/LocationContext';

export type { ServiceArea };

const optionStyle = (active: boolean): React.CSSProperties => ({
  textAlign: 'left',
  padding: '0.5rem 0.75rem',
  borderRadius: '6px',
  background: active ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
  border: 'none',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

/** City picker in the navbar. The choice is shared app-wide (Browse filter, new listing location). */
export const LocationSelector: React.FC = () => {
  const { areas, selectedArea, setSelectedArea } = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const choose = (area: ServiceArea | null) => {
    setSelectedArea(area);
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px',
          background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent-primary)', color: 'var(--text-primary)',
          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
        }}
      >
        <MapPin size={16} color="var(--accent-primary)" />
        <span>{selectedArea ? selectedArea.cityName : 'All cities'}</span>
      </button>

      {isOpen && (
        <div className="glass-panel" style={{ position: 'absolute', top: '110%', left: 0, width: '260px', padding: '1rem', zIndex: 100, boxShadow: 'var(--shadow)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Choose your city</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '260px', overflowY: 'auto' }}>
            <button onClick={() => choose(null)} style={optionStyle(!selectedArea)}>All cities</button>
            {areas.map((area) => (
              <button key={area.id} onClick={() => choose(area)} style={optionStyle(selectedArea?.id === area.id)}>
                <span>{area.cityName}, {area.stateName}</span>
                {area.buyingEnabled && area.sellingEnabled ? <CheckCircle size={14} color="#10b981" /> : <AlertTriangle size={14} color="#f59e0b" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
