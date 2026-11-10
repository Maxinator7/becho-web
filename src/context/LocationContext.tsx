import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchApi } from '../api/client';

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

interface LocationContextType {
  areas: ServiceArea[];
  /** null = all cities */
  selectedArea: ServiceArea | null;
  setSelectedArea: (area: ServiceArea | null) => void;
}

const STORAGE_KEY = 'becho.cityCode';
const LocationContext = createContext<LocationContextType>({ areas: [], selectedArea: null, setSelectedArea: () => {} });

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [selectedArea, setSelected] = useState<ServiceArea | null>(null);

  useEffect(() => {
    fetchApi<ServiceArea[]>('/locations/service-areas').then((res) => {
      if (!res.success || !res.data) return;
      setAreas(res.data);
      let saved: string | null = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
      setSelected(res.data.find((a) => a.cityCode === saved) ?? null);
    });
  }, []);

  const setSelectedArea = (area: ServiceArea | null) => {
    setSelected(area);
    try {
      if (area) localStorage.setItem(STORAGE_KEY, area.cityCode);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  return <LocationContext.Provider value={{ areas, selectedArea, setSelectedArea }}>{children}</LocationContext.Provider>;
};

export const useLocation = () => useContext(LocationContext);
