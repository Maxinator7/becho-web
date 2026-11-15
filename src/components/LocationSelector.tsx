import React, { useEffect, useRef, useState } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import { useLocation, ServiceArea } from '../context/LocationContext';

export type { ServiceArea };

/** City pill in the top bar. The choice is shared app-wide (Browse filter, new listing location). */
export const LocationSelector: React.FC = () => {
  const { areas, selectedArea, setSelectedArea } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [isOpen]);

  const choose = (area: ServiceArea | null) => {
    setSelectedArea(area);
    setIsOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button type="button" className="city-pill" onClick={() => setIsOpen(!isOpen)} aria-haspopup="listbox" aria-expanded={isOpen} aria-label={`City: ${selectedArea ? selectedArea.cityName : 'All cities'}. Change city`}>
        <MapPin size={16} color="var(--primary-text)" />
        <span>{selectedArea ? `${selectedArea.cityName}, ${selectedArea.stateCode}` : 'All cities'}</span>
        <ChevronDown size={15} color="var(--text-muted)" />
      </button>

      {isOpen && (
        <div className="menu" style={{ left: 0, right: 'auto', width: 'min(280px, calc(100vw - 32px))' }}>
          <div className="overline" style={{ padding: '6px 10px 8px' }}>Choose your city</div>
          <div role="listbox" aria-label="Cities" style={{ display: 'flex', flexDirection: 'column', maxHeight: '300px', overflowY: 'auto' }}>
            <button type="button" role="option" aria-selected={!selectedArea} className="menu-item" onClick={() => choose(null)} style={{ justifyContent: 'space-between' }}>
              All cities {!selectedArea && <Check size={16} color="var(--primary-text)" />}
            </button>
            {areas.map((area) => {
              const on = selectedArea?.id === area.id;
              const partial = !(area.buyingEnabled && area.sellingEnabled);
              return (
                <button key={area.id} type="button" role="option" aria-selected={on} className="menu-item" onClick={() => choose(area)} style={{ justifyContent: 'space-between' }}>
                  <span>
                    {area.cityName}, {area.stateName}
                    {partial && (
                      <span className="muted" style={{ display: 'block', fontSize: '0.72rem' }}>
                        {area.buyingEnabled ? 'Browsing only for now' : area.sellingEnabled ? 'Selling only for now' : 'Coming soon'}
                      </span>
                    )}
                  </span>
                  {on && <Check size={16} color="var(--primary-text)" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
