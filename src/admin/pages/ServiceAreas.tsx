import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, Plus, Search, ShoppingBag, Store, Tag } from 'lucide-react';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Analytics, ServiceArea } from '../types';
import { Button, EmptyState, ErrorBanner, Loading, Modal, PageHeader, Pill, apiError, fmtNum, useToast, type Tone } from '../ui';

type Flag = 'buyingEnabled' | 'sellingEnabled' | 'isActive';
type Tab = 'all' | 'full' | 'restricted';

/** One status for a city card, from its three switches. */
function areaStatus(a: ServiceArea): [string, Tone] {
  if (!a.isActive) return ['City inactive', 'neutral'];
  if (a.buyingEnabled && a.sellingEnabled) return ['Fully operational', 'success'];
  if (a.buyingEnabled) return ['Selling paused', 'warning'];
  if (a.sellingEnabled) return ['Buying paused', 'warning'];
  return ['Buying & selling paused', 'danger'];
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

const FLAG_COPY: Record<Flag, { name: string; off: (city: string) => string; on: (city: string) => string }> = {
  buyingEnabled: {
    name: 'Buyer discovery & offers',
    off: (c) => `Buyers whose location is ${c} will be told Becho isn’t open for buying there yet.`,
    on: (c) => `Buyers whose location is ${c} can browse and make offers again.`,
  },
  sellingEnabled: {
    name: 'Seller ad posting',
    off: (c) => `Sellers in ${c} won’t be able to create new ads. Ads that are already live stay up.`,
    on: (c) => `Sellers in ${c} can post new ads again.`,
  },
  isActive: {
    name: 'City',
    off: (c) => `${c} will disappear from the marketplace’s list of cities, and buying and selling there will stop. Existing ads stay as they are.`,
    on: (c) => `${c} will show in the marketplace again, with the buying and selling switches as they are set below.`,
  },
};

/* ------------------------------------------------------------------ */

const Switch: React.FC<{ checked: boolean; label: string; disabled?: boolean; busy?: boolean; title?: string; onChange: () => void }> = ({ checked, label, disabled, busy, title, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={title}
    disabled={disabled || busy}
    onClick={onChange}
    className={`a-switch${busy ? ' is-busy' : ''}`}
  >
    <span className="a-switch__knob" />
  </button>
);

const CoverageKpi: React.FC<{ label: string; icon: React.ReactNode; on: number; of: number; noun: string }> = ({ label, icon, on, of, noun }) => {
  const p = pct(on, of);
  return (
    <div className="a-kpi">
      <div className="a-kpi__top">
        <span className="a-kpi__label">{label}</span>
        <span className="a-kpi__icon" aria-hidden>{icon}</span>
      </div>
      <div className="a-kpi__value">{p}%</div>
      <div className="a-kpi__delta">{on} of {of} active cities {noun}</div>
      <div className="a-meter" role="img" aria-label={`${p}%`}><span style={{ width: `${p}%` }} /></div>
    </div>
  );
};

/* ------------------------------------------------------------------ */

const CODE_RE = /^[A-Z0-9]+$/;

const AddCityDialog: React.FC<{ existing: ServiceArea[]; onClose: () => void; onCreated: (a: ServiceArea) => void }> = ({ existing, onClose, onCreated }) => {
  const [f, setF] = useState({ cityName: '', cityCode: '', stateName: '', stateCode: '', buyingEnabled: true, sellingEnabled: true });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  // Picking a state that already exists fills its code (and vice versa).
  const states = useMemo(() => {
    const m = new Map<string, string>();
    existing.forEach((a) => m.set(a.stateName, a.stateCode));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [existing]);

  const errs: Record<string, string | null> = {
    cityName: !f.cityName.trim() ? 'Enter the city name.' : f.cityName.trim().length > 80 ? 'Use at most 80 characters.' : null,
    cityCode: !f.cityCode ? 'Enter a short city code, e.g. JAI.' : f.cityCode.length > 20 || !CODE_RE.test(f.cityCode) ? 'Letters and numbers only, up to 20.' : null,
    stateName: !f.stateName.trim() ? 'Enter the state name.' : f.stateName.trim().length > 80 ? 'Use at most 80 characters.' : null,
    stateCode: !f.stateCode ? 'Enter the state code, e.g. RJ.' : f.stateCode.length > 10 || !CODE_RE.test(f.stateCode) ? 'Letters and numbers only, up to 10.' : null,
  };
  if (!errs.cityCode && !errs.stateCode && existing.some((a) => a.countryCode === 'IN' && a.stateCode === f.stateCode && a.cityCode === f.cityCode)) {
    errs.cityCode = `${f.stateCode} / ${f.cityCode} already exists.`;
  }
  const invalid = Object.values(errs).some(Boolean);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (invalid) return;
    setBusy(true);
    setError(null);
    const res = await fetchApi<ServiceArea>('/locations/admin/service-areas', {
      method: 'POST',
      body: JSON.stringify({
        countryCode: 'IN',
        cityName: f.cityName.trim(), cityCode: f.cityCode, stateName: f.stateName.trim(), stateCode: f.stateCode,
        isActive: true, buyingEnabled: f.buyingEnabled, sellingEnabled: f.sellingEnabled,
      }),
    });
    setBusy(false);
    if (res.success && res.data) onCreated(res.data);
    else setError(res.error?.code === 'CONFLICT' ? 'A city with this state and city code already exists.' : apiError(res, 'Could not add the city'));
  };

  const text = (k: 'cityName' | 'cityCode' | 'stateName' | 'stateCode', label: string, opts: { upper?: boolean; placeholder?: string; list?: string; max: number }) => (
    <div>
      <label className="a-label" htmlFor={`sa-${k}`}>{label}</label>
      <input
        id={`sa-${k}`}
        className={`a-input${opts.upper ? ' a-mono' : ''}`}
        value={f[k]}
        maxLength={opts.max}
        list={opts.list}
        placeholder={opts.placeholder}
        aria-invalid={touched && !!errs[k]}
        aria-describedby={`sa-${k}-err`}
        onChange={(e) => {
          const v = opts.upper ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value;
          set(k, v);
          if (k === 'stateName') { const code = states.find(([n]) => n === v)?.[1]; if (code) set('stateCode', code); }
        }}
      />
      {touched && errs[k] && <div id={`sa-${k}-err`} className="a-field-err">{errs[k]}</div>}
    </div>
  );

  return (
    <Modal
      title="Add a city"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()} loading={busy}>Add city</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && <ErrorBanner message={error} />}
        <div className="a-form-2">
          {text('cityName', 'City name', { placeholder: 'Jaipur', max: 80 })}
          {text('cityCode', 'City code', { upper: true, placeholder: 'JAI', max: 20 })}
          {text('stateName', 'State', { placeholder: 'Rajasthan', list: 'sa-states', max: 80 })}
          {text('stateCode', 'State code', { upper: true, placeholder: 'RJ', max: 10 })}
        </div>
        <datalist id="sa-states">{states.map(([n]) => <option key={n} value={n} />)}</datalist>
        <div className="a-small a-text-2">
          Codes must match the ones the marketplace uses for a user’s location (state codes like MH, KA; city codes like MUM, BLR).
        </div>
        <div className="a-sa-toggles" style={{ borderTop: 'none', paddingTop: 0 }}>
          <div className="a-sa-toggle">
            <span><ShoppingBag size={15} /> Buyer discovery & offers</span>
            <Switch checked={f.buyingEnabled} label="Buyer discovery & offers" onChange={() => set('buyingEnabled', !f.buyingEnabled)} />
          </div>
          <div className="a-sa-toggle">
            <span><Store size={15} /> Seller ad posting</span>
            <Switch checked={f.sellingEnabled} label="Seller ad posting" onChange={() => set('sellingEnabled', !f.sellingEnabled)} />
          </div>
        </div>
      </form>
    </Modal>
  );
};

/* ------------------------------------------------------------------ */

export const ServiceAreasPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const toast = useToast();
  const [areas, setAreas] = useState<ServiceArea[] | null>(null);
  const [liveByCity, setLiveByCity] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [busy, setBusy] = useState<string | null>(null); // `${id}:${flag}`
  const [confirm, setConfirm] = useState<{ area: ServiceArea; flag: Flag } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetchApi<ServiceArea[]>('/locations/admin/service-areas').then((res) => {
      if (res.success && res.data) setAreas(res.data);
      else setError(apiError(res, 'Could not load service areas'));
    });
    fetchApi<Analytics>('/admin/analytics?days=7').then((res) => {
      if (res.success && res.data) setLiveByCity(Object.fromEntries(res.data.byCity.map((c) => [c.cityCode, c.count])));
    });
  }, []);
  useEffect(load, [load]);

  const all = areas ?? [];
  const active = all.filter((a) => a.isActive);
  const isFull = (a: ServiceArea) => a.isActive && a.buyingEnabled && a.sellingEnabled;
  const isRestricted = (a: ServiceArea) => a.isActive && !a.sellingEnabled;
  const counts = { all: all.length, full: all.filter(isFull).length, restricted: all.filter(isRestricted).length };
  const stateCount = new Set(active.map((a) => a.stateCode)).size;

  const q = search.trim().toLowerCase();
  const shown = all
    .filter((a) => (tab === 'full' ? isFull(a) : tab === 'restricted' ? isRestricted(a) : true))
    .filter((a) => !q || [a.cityName, a.stateName, a.cityCode, a.stateCode].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || (liveByCity?.[b.cityCode] ?? 0) - (liveByCity?.[a.cityCode] ?? 0) || a.cityName.localeCompare(b.cityName));

  const apply = async (area: ServiceArea, flag: Flag) => {
    const next = !area[flag];
    const key = `${area.id}:${flag}`;
    setBusy(key);
    const res = await fetchApi<ServiceArea>(`/locations/admin/service-areas/${area.id}`, { method: 'PATCH', body: JSON.stringify({ [flag]: next }) });
    setBusy(null);
    if (res.success && res.data) {
      const updated = res.data;
      setAreas((list) => list?.map((a) => (a.id === updated.id ? updated : a)) ?? list);
      toast('success', `${FLAG_COPY[flag].name} ${next ? 'turned on' : 'turned off'} for ${area.cityName}.`);
      return null;
    }
    const msg = apiError(res, `Could not update ${area.cityName}`);
    toast('danger', msg);
    return msg;
  };

  const toggle = (area: ServiceArea, flag: Flag) => setConfirm({ area, flag });

  const adminOnly = isAdmin ? undefined : 'Only admins can change service areas';

  return (
    <div>
      <PageHeader
        overline="Regional administration"
        title="Service areas & market operations"
        subtitle="Choose which cities are open on Becho, and whether buyers and sellers can use the marketplace there."
      />
      {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!areas && !error ? (
        <Loading />
      ) : areas ? (
        <div className="a-stack">
          <div className="a-kpis a-kpis--4">
            <div className="a-kpi">
              <div className="a-kpi__top">
                <span className="a-kpi__label">Active cities</span>
                <span className="a-kpi__icon" aria-hidden><Building2 size={16} /></span>
              </div>
              <div className="a-kpi__value">{active.length}</div>
              <div className="a-kpi__delta">across {stateCount} {stateCount === 1 ? 'state' : 'states'}{all.length > active.length && <> · {all.length - active.length} inactive</>}</div>
            </div>
            <div className="a-kpi">
              <div className="a-kpi__top">
                <span className="a-kpi__label">Fully operational</span>
                <span className="a-kpi__icon" aria-hidden><MapPin size={16} /></span>
              </div>
              <div className="a-kpi__value">{counts.full}</div>
              <div className="a-kpi__delta">buying and selling both on{active.length - counts.full > 0 && <> · {active.length - counts.full} restricted</>}</div>
            </div>
            <CoverageKpi label="Buying coverage" icon={<ShoppingBag size={16} />} on={active.filter((a) => a.buyingEnabled).length} of={active.length} noun="open to buyers" />
            <CoverageKpi label="Selling coverage" icon={<Tag size={16} />} on={active.filter((a) => a.sellingEnabled).length} of={active.length} noun="open to sellers" />
          </div>

          <div className="a-card a-sa-bar">
            <div className="a-input-wrap" style={{ flex: '1 1 260px', maxWidth: 360 }}>
              <Search size={16} />
              <input type="search" className="a-input a-input--soft" aria-label="Filter cities" placeholder="Filter city or state…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="a-seg" role="tablist" aria-label="City filter">
              {([['all', 'All cities'], ['full', 'Fully active'], ['restricted', 'Restricted selling']] as [Tab, string][]).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} className="a-seg__btn" onClick={() => setTab(k)}>
                  {label} ({counts[k]})
                </button>
              ))}
            </div>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)} disabled={!isAdmin} title={adminOnly} style={{ marginLeft: 'auto' }}>
              Add new city
            </Button>
          </div>

          {!isAdmin && <div className="a-banner a-banner--info">You can view service areas. Only admins can switch buying or selling on and off, or add cities.</div>}

          {shown.length === 0 ? (
            <div className="a-card">
              <EmptyState icon={<MapPin size={28} />} title={all.length === 0 ? 'No service areas yet' : 'No cities match'}>
                {all.length === 0 ? 'Add the first city to open the marketplace there.' : 'Try another search or tab.'}
              </EmptyState>
            </div>
          ) : (
            <div className="a-sa-grid">
              {shown.map((a) => {
                const [label, tone] = areaStatus(a);
                const live = liveByCity ? liveByCity[a.cityCode] ?? 0 : null;
                return (
                  <article key={a.id} className={`a-card a-sa-card${a.isActive ? '' : ' is-inactive'}`}>
                    <div className="a-sa-card__head">
                      <div style={{ minWidth: 0 }}>
                        <h2 className="a-sa-card__city">{a.cityName}</h2>
                        <div className="a-small a-text-2">{a.stateName} · <span className="a-mono">{a.stateCode}/{a.cityCode}</span></div>
                      </div>
                      <Pill tone={tone} round icon={<span className="a-dot" />}>{label}</Pill>
                    </div>
                    {live != null && (
                      <Link className="a-sa-card__stat" to={`/listings?status=LIVE&cityCode=${a.cityCode}`}>
                        <span className="a-mini__label">Live listings</span>
                        <span className="a-sa-card__num">{fmtNum(live)} {live === 1 ? 'ad' : 'ads'}</span>
                      </Link>
                    )}
                    <div className="a-sa-toggles">
                      <div className="a-sa-toggle">
                        <span><ShoppingBag size={15} /> Buyer discovery & offers</span>
                        <Switch checked={a.buyingEnabled} label={`Buyer discovery & offers in ${a.cityName}`} disabled={!isAdmin} title={adminOnly} busy={busy === `${a.id}:buyingEnabled`} onChange={() => toggle(a, 'buyingEnabled')} />
                      </div>
                      <div className="a-sa-toggle">
                        <span><Store size={15} /> Seller ad posting</span>
                        <Switch checked={a.sellingEnabled} label={`Seller ad posting in ${a.cityName}`} disabled={!isAdmin} title={adminOnly} busy={busy === `${a.id}:sellingEnabled`} onChange={() => toggle(a, 'sellingEnabled')} />
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="a-sa-card__foot">
                        <button type="button" className="a-link" style={{ fontSize: 12.5 }} disabled={busy === `${a.id}:isActive`} onClick={() => toggle(a, 'isActive')}>
                          {a.isActive ? 'Deactivate city' : 'Reactivate city'}
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {confirm && (() => {
        const { area, flag } = confirm;
        const turningOn = !area[flag];
        const copy = FLAG_COPY[flag];
        const title = flag === 'isActive' ? `${turningOn ? 'Reactivate' : 'Deactivate'} ${area.cityName}?` : `Turn ${turningOn ? 'on' : 'off'} ${copy.name.toLowerCase()} in ${area.cityName}?`;
        return (
          <ConfirmToggle
            title={title}
            body={turningOn ? copy.on(area.cityName) : copy.off(area.cityName)}
            confirmLabel={turningOn ? 'Turn on' : 'Turn off'}
            danger={!turningOn}
            onClose={() => setConfirm(null)}
            onConfirm={async () => { const err = await apply(area, flag); if (!err) setConfirm(null); return err; }}
          />
        );
      })()}

      {adding && areas && (
        <AddCityDialog
          existing={areas}
          onClose={() => setAdding(false)}
          onCreated={(a) => {
            setAdding(false);
            setAreas((list) => [...(list ?? []), a]);
            toast('success', `${a.cityName} added.`);
          }}
        />
      )}
    </div>
  );
};

const ConfirmToggle: React.FC<{ title: string; body: string; confirmLabel: string; danger: boolean; onClose: () => void; onConfirm: () => Promise<string | null> }> = ({ title, body, confirmLabel, danger, onClose, onConfirm }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button
            variant={danger ? 'danger-solid' : 'primary'}
            loading={busy}
            onClick={async () => { setBusy(true); setError(null); const err = await onConfirm(); setBusy(false); if (err) setError(err); }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <div style={{ marginBottom: 12 }}><ErrorBanner message={error} /></div>}
      <p style={{ fontSize: 14, color: 'var(--a-text-2)', lineHeight: 1.55 }}>{body}</p>
      <p className="a-small a-muted" style={{ marginTop: 10 }}>You can change this back at any time.</p>
    </Modal>
  );
};
