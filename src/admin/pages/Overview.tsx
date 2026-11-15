import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CalendarDays, Hourglass, Info, MessageSquare, Package, RefreshCw, ShoppingBag, TrendingUp, Users } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { Analytics } from '../types';
import { Card, ErrorBanner, Loading, PageHeader, apiError, fmtNum, humanize } from '../ui';
import { ChartCard, HBarChart, LineChart, SERIES_COLORS } from '../charts';

const PERIODS = [7, 30, 90] as const;
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const rangeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const pctNum = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
const pct1 = (part: number, whole: number) => {
  if (whole <= 0) return '—';
  const v = (part / whole) * 100;
  return `${v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)}%`;
};
const hours = (h: number | null) => (h == null ? '—' : `${h < 10 ? h.toFixed(1) : Math.round(h)} h`);

const Kpi: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  foot?: [React.ReactNode, React.ReactNode];
  to?: string;
}> = ({ label, icon, value, delta, foot, to }) => {
  const body = (
    <>
      <div className="a-kpi__top">
        <span className="a-kpi__label">{label}</span>
        <span className="a-kpi__icon" aria-hidden>{icon}</span>
      </div>
      <div className="a-kpi__value">{value}</div>
      {delta && <div className="a-kpi__delta">{delta}</div>}
      {foot && (
        <div className="a-kpi__foot">
          <span>{foot[0]}</span>
          <strong>{foot[1]}</strong>
        </div>
      )}
    </>
  );
  return to ? <Link to={to} className="a-kpi">{body}</Link> : <div className="a-kpi">{body}</div>;
};

export const OverviewPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetchApi<Analytics>(`/admin/analytics?days=${days}`);
    setLoading(false);
    if (res.success && res.data) setData(res.data);
    else setError(apiError(res, 'Could not load analytics'));
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const s = data?.series ?? [];
  const daysAxis = s.map((d) => d.day);
  const live = t?.listings.byStatus.LIVE ?? 0;
  const f = data?.funnel;
  const mod = data?.moderation;
  const modActions = Object.entries(mod?.actions ?? {}).sort((a, b) => b[1] - a[1]);
  const cityTotal = data?.byCity.reduce((a, c) => a + c.count, 0) ?? 0;
  const catTotal = data?.byCategory.reduce((a, c) => a + c.count, 0) ?? 0;
  const catMax = Math.max(0, ...(data?.byCategory.map((c) => c.count) ?? []));

  const range = data && s.length ? `${rangeFmt.format(new Date(`${s[0].day}T00:00:00`))} – ${rangeFmt.format(new Date(`${s[s.length - 1].day}T00:00:00`))}` : null;

  const actions = (
    <div className="a-row" style={{ gap: 10 }}>
      {range && (
        <span className="a-chip" style={{ height: 38, padding: '0 12px', background: 'var(--a-surface)', border: '1px solid var(--a-border)', color: 'var(--a-text)', fontWeight: 500 }}>
          <CalendarDays size={15} /> {range}
        </span>
      )}
      <div role="radiogroup" aria-label="Period" className="a-seg">
        {PERIODS.map((p) => (
          <button key={p} role="radio" aria-checked={days === p} onClick={() => setDays(p)}>
            {p} days
          </button>
        ))}
      </div>
      <button type="button" className="a-iconbtn" onClick={load} aria-label="Refresh" title="Refresh">
        <RefreshCw size={16} className={loading ? 'a-spin' : undefined} />
      </button>
    </div>
  );

  // Header % = conversion from the previous step; bar = share of all published listings.
  const steps = f
    ? [
        { label: 'Published', value: f.published, prev: f.published, note: 'Listings published in period' },
        { label: 'Got an offer', value: f.withOffer, prev: f.published, note: `${pct1(f.withOffer, f.published)} of published` },
        { label: 'Deal agreed', value: f.withDeal, prev: f.withOffer, note: `${pct1(f.withDeal, f.published)} of published` },
        { label: 'Sold', value: f.sold, prev: f.withDeal, note: `${pct1(f.sold, f.published)} of published` },
      ]
    : [];

  return (
    <div>
      <PageHeader
        overline="Marketplace operations"
        meta={data ? `Updated ${timeFmt.format(new Date(data.generatedAt))} · days in IST` : undefined}
        title="Trust & marketplace overview"
        actions={actions}
      />
      {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!data && loading && <Loading label="Loading analytics…" />}
      {data && t && f && mod && (
        <div className="a-stack" style={{ gap: 24, opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <div className="a-kpis">
            <Kpi
              label="Live listings"
              icon={<Package size={16} />}
              value={fmtNum(live)}
              to="/listings?status=LIVE"
              delta={<><span className="a-chip a-chip--success"><TrendingUp size={12} /> +{fmtNum(t.listings.newInPeriod)}</span> new in {data.periodDays} days</>}
              foot={['Verified live', `${fmtNum(t.listings.verifiedLive)} (${pct(t.listings.verifiedLive, live)})`]}
            />
            <Kpi
              label="Staff review queue"
              icon={<Hourglass size={16} />}
              value={<>{fmtNum(mod.queueSize)} <span style={{ fontSize: 14, fontWeight: 600, color: mod.queueSize > 0 ? 'var(--a-warning-text)' : 'var(--a-success-text)' }}>{mod.queueSize > 0 ? 'waiting' : 'all clear'}</span></>}
              to="/queue"
              delta={<><span className="a-chip a-chip--accent">Avg {hours(mod.avgHoursToApprove)}</span> to approve</>}
              foot={['Reviewed in period', fmtNum(mod.reviewedInPeriod)]}
            />
            <Kpi
              label="Registered users"
              icon={<Users size={16} />}
              value={fmtNum(t.users.total)}
              to="/users"
              delta={<><span className="a-chip a-chip--success"><TrendingUp size={12} /> +{fmtNum(t.users.newInPeriod)}</span> joined in period</>}
              foot={['Signed in (period)', fmtNum(t.users.signedInInPeriod)]}
            />
            <Kpi
              label="Offers made"
              icon={<BadgeCheck size={16} />}
              value={fmtNum(t.offersInPeriod)}
              delta={<><span className="a-chip a-chip--accent">{fmtNum(t.dealsInPeriod)} deals</span> offers accepted</>}
              foot={['Acceptance', pct(t.dealsInPeriod, t.offersInPeriod)]}
            />
            <Kpi
              label="Sold"
              icon={<ShoppingBag size={16} />}
              value={fmtNum(t.soldInPeriod)}
              delta={<><span className="a-chip"><MessageSquare size={12} /> {fmtNum(t.messagesInPeriod)}</span> messages sent</>}
              foot={['New chats', fmtNum(t.conversationsInPeriod)]}
            />
          </div>

          {/* Funnel */}
          <Card
            title={<>Listing conversion funnel <span title="Of the listings published in this period, how many went on to each stage. Percentages are of the previous step." style={{ display: 'inline-flex', color: 'var(--a-muted)' }}><Info size={15} /></span></>}
            subtitle={`Listings published in the last ${data.periodDays} days, followed through to sale`}
            actions={
              <div className="a-legend">
                <span><span className="a-legend__sw" style={{ background: 'var(--a-primary)' }} />Bar: share of published · % vs previous step</span>
                <span className="a-chip a-chip--accent">Overall sold: {pct1(f.sold, f.published)}</span>
              </div>
            }
          >
            <ol className="a-funnel" aria-label="Listing funnel">
              {steps.map((st, i) => (
                <li key={st.label} className={`a-step${i === steps.length - 1 ? ' a-step--final' : ''}`}>
                  <div className="a-step__top">
                    <span>STEP {String(i + 1).padStart(2, '0')}</span>
                    <span title={i === 0 ? undefined : 'Conversion from the previous step'}>{pct1(st.value, st.prev)}</span>
                  </div>
                  <div className="a-step__bar" role="presentation"><span style={{ width: `${Math.min(100, pctNum(st.value, f.published))}%` }} /></div>
                  <div className="a-step__label">{st.label}</div>
                  <div className="a-step__value">{fmtNum(st.value)}</div>
                  <div className="a-step__note">{st.note}</div>
                </li>
              ))}
            </ol>
          </Card>

          {/* City + category */}
          <div className="a-grid-city">
            <ChartCard
              title="Listings by metro city"
              subtitle="Live listings right now, share of total"
              table={{ columns: ['City', 'Live listings', 'Share'], rows: data.byCity.map((c) => [`${c.cityName} (${c.cityCode})`, c.count, pct1(c.count, cityTotal)]) }}
            >
              {data.byCity.length === 0 || cityTotal === 0 ? (
                <div className="a-empty">No live listings yet.</div>
              ) : (
                <ul className="a-bars">
                  {data.byCity.map((c, i) => (
                    <li key={c.cityCode} className="a-bar" tabIndex={0} aria-label={`${c.cityName}: ${fmtNum(c.count)} live listings, ${pct1(c.count, cityTotal)}`}>
                      <div className="a-bar__row">
                        <span className="a-dot" style={{ width: 8, height: 8, color: i === 0 ? 'var(--a-primary)' : 'var(--a-ink)' }} />
                        <span className="a-bar__name">{c.cityName}</span>
                        <span className="a-bar__val">{fmtNum(c.count)}</span>
                        <span className="a-bar__pct">({pct1(c.count, cityTotal)})</span>
                      </div>
                      <div className="a-bar__track"><div className="a-bar__fill" style={{ width: `${pctNum(c.count, cityTotal)}%`, background: i === 0 ? 'var(--a-primary)' : 'var(--a-ink)' }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </ChartCard>

            <ChartCard
              title="Category volume"
              subtitle="Live listings by top-level category"
              table={{ columns: ['Category', 'Live listings', 'Share'], rows: data.byCategory.map((c) => [c.name, c.count, pct1(c.count, catTotal)]) }}
            >
              {data.byCategory.length === 0 || catTotal === 0 ? (
                <div className="a-empty">No live listings yet.</div>
              ) : (
                <div className="a-table-wrap">
                  <table className="a-table a-table--compact">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th className="a-th-num">Live listings</th>
                        <th className="a-th-num">Share</th>
                        <th style={{ width: '34%' }}><span className="a-sr">Relative volume</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCategory.map((c) => (
                        <tr key={c.name}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td className="a-td-num">{fmtNum(c.count)}</td>
                          <td className="a-td-num a-text-2">{pct1(c.count, catTotal)}</td>
                          <td aria-hidden>
                            <div className="a-bar__track" style={{ height: 6 }}><div className="a-bar__fill" style={{ width: `${pctNum(c.count, catMax)}%` }} /></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Daily charts */}
          <div className="a-grid-2">
            <ChartCard
              title="New users & new listings"
              subtitle="Per day"
              legend={[{ label: 'New users', color: SERIES_COLORS[0] }, { label: 'New listings', color: SERIES_COLORS[1] }]}
              table={{ columns: ['Day', 'New users', 'New listings'], rows: s.map((d) => [d.day, d.newUsers, d.newListings]) }}
            >
              <LineChart
                days={daysAxis}
                series={[
                  { key: 'u', label: 'New users', color: SERIES_COLORS[0], values: s.map((d) => d.newUsers) },
                  { key: 'l', label: 'New listings', color: SERIES_COLORS[1], values: s.map((d) => d.newListings) },
                ]}
              />
            </ChartCard>
            <ChartCard
              title="Offers, deals & sold"
              subtitle="Per day"
              legend={[{ label: 'Offers', color: SERIES_COLORS[0] }, { label: 'Deals', color: SERIES_COLORS[1] }, { label: 'Sold', color: SERIES_COLORS[2] }]}
              table={{ columns: ['Day', 'Offers', 'Deals', 'Sold'], rows: s.map((d) => [d.day, d.offers, d.deals, d.sold]) }}
            >
              <LineChart
                days={daysAxis}
                series={[
                  { key: 'o', label: 'Offers', color: SERIES_COLORS[0], values: s.map((d) => d.offers) },
                  { key: 'd', label: 'Deals', color: SERIES_COLORS[1], values: s.map((d) => d.deals) },
                  { key: 's', label: 'Sold', color: SERIES_COLORS[2], values: s.map((d) => d.sold) },
                ]}
              />
            </ChartCard>
          </div>

          <div className="a-grid-2">
            <ChartCard title="Messages sent" subtitle="Per day" table={{ columns: ['Day', 'Messages'], rows: s.map((d) => [d.day, d.messages]) }}>
              <LineChart days={daysAxis} series={[{ key: 'm', label: 'Messages', color: SERIES_COLORS[0], values: s.map((d) => d.messages) }]} emptyText="No messages in this period" />
            </ChartCard>
            <ChartCard
              title="Moderation"
              subtitle={`Staff actions in the last ${data.periodDays} days`}
              table={{ columns: ['Action', 'Count'], rows: modActions.map(([k, v]) => [humanize(k), v]) }}
            >
              <div className="a-row" style={{ gap: 10, marginBottom: 16, flexWrap: 'nowrap' }}>
                <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">In queue</div><div className="a-mini__value">{fmtNum(mod.queueSize)}</div></div>
                <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Reviewed</div><div className="a-mini__value">{fmtNum(mod.reviewedInPeriod)}</div></div>
                <div className="a-mini" style={{ flex: 1 }}><div className="a-mini__label">Avg to approve</div><div className="a-mini__value">{hours(mod.avgHoursToApprove)}</div></div>
              </div>
              <HBarChart rows={modActions.map(([k, v]) => ({ label: humanize(k), value: v }))} emptyText="No moderation actions in this period" />
            </ChartCard>
          </div>

          <ChartCard
            title="Users by status"
            subtitle="All accounts"
            table={{ columns: ['Status', 'Users'], rows: Object.entries(t.users.byStatus).map(([k, v]) => [humanize(k), v]) }}
          >
            <HBarChart rows={Object.entries(t.users.byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: humanize(k), value: v }))} emptyText="No users yet" />
          </ChartCard>
        </div>
      )}
    </div>
  );
};
