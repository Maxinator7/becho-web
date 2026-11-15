import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useDebounced } from './ui';

/** Search box bound to the `search` URL param, debounced so typing doesn't spam the API. */
export const SearchBox: React.FC<{ placeholder: string; label: string; width?: number | string }> = ({ placeholder, label, width = 320 }) => {
  const [params, setParams] = useSearchParams();
  const urlValue = params.get('search') ?? '';
  const [value, setValue] = useState(urlValue);
  const debounced = useDebounced(value, 300);

  useEffect(() => {
    // Keep the box in sync when the URL changes from elsewhere (back button, header search, clear filters).
    // Skip echoes of our own debounced write so in-progress typing isn't clobbered.
    if (urlValue !== debounced.trim()) setValue(urlValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlValue]);

  useEffect(() => {
    if (debounced.trim() === urlValue) return;
    setParams((p) => {
      const next = new URLSearchParams(p);
      if (debounced.trim()) next.set('search', debounced.trim());
      else next.delete('search');
      next.delete('page');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="a-input-wrap" style={{ flex: `1 1 ${typeof width === 'number' ? `${width}px` : width}`, minWidth: 200, maxWidth: 440 }}>
      <Search size={16} />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="a-input a-input--soft"
        style={{ paddingRight: value ? 34 : undefined }}
      />
      {value && (
        <span className="a-input-wrap__end">
          <button type="button" aria-label="Clear search" onClick={() => setValue('')} className="a-iconbtn" style={{ width: 28, height: 28 }}>
            <X size={15} />
          </button>
        </span>
      )}
    </div>
  );
};

/** A <select> bound to a URL param; changing it resets to page 1. */
export const ParamSelect: React.FC<{ name: string; label: string; options: [string, string][]; allLabel?: string; defaultValue?: string }> = ({ name, label, options, allLabel, defaultValue = '' }) => {
  const [params, setParams] = useSearchParams();
  return (
    <select
      aria-label={label}
      className="a-select a-select--soft"
      value={params.get(name) ?? defaultValue}
      onChange={(e) =>
        setParams((p) => {
          const next = new URLSearchParams(p);
          if (e.target.value && e.target.value !== defaultValue) next.set(name, e.target.value);
          else next.delete(name);
          next.delete('page');
          return next;
        })
      }
    >
      {allLabel !== undefined && <option value="">{allLabel}</option>}
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
};

export const usePageParam = (): [number, (p: number) => void] => {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  return [page, (p) => setParams((prev) => { const n = new URLSearchParams(prev); if (p > 1) n.set('page', String(p)); else n.delete('page'); return n; })];
};

export const isLocked = (lockedUntil: string | null | undefined) => !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();
