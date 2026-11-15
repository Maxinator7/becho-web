import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { Analytics } from '../types';
import { Button, ErrorBanner, Loading, PageHeader, apiError, fmtDateTime, fmtNum, humanize, toneText } from '../ui';
import { ChartCard, HBarChart, LineChart, SERIES_COLORS } from '../charts';

const PERIODS = [7, 30, 90] as const;

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

const Kpi: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; to?: string }> = ({ label, value, hint, to }) => {
  const body = (
    <>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.2, marginTop: '0.15rem' }}>{value}</div>
      {hint && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{hint}</div>}
    </>
  );
  const style: React.CSSProperties = { padding: '0.95rem 1.05rem', minWidth: 0, display: 'block' };
  return to ? (
    <Link to={to} className="glass-panel adm-focus" style={style}>{body}</Link>
  ) : (
    <div className="glass-panel" style={style}>{body}</div>
  );
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

  const periodSelector = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div role="radiogroup" aria-label="Period" style={{ display: 'inline-flex', background: 'var(--surface-2)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '3px' }}>
        {PERIODS.map((p) => (
          <button
            key={p}
            role="radio"
            aria-checked={days === p}
            onClick={() => setDays(p)}
            className="adm-btn"
            style={{
              padding: '0.35rem 0.8rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: '6px',
              background: days === p ? 'var(--bg-secondary)' : 'transparent',
              color: days === p ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: days === p ? 'var(--shadow-card)' : 'none',
              border: days === p ? '1px solid var(--border-strong)' : '1px solid transparent',
            }}
          >
            {p} days
          </button>
        ))}
      </div>
      <Button small variant="ghost" icon={<RefreshCw size={14} />} onClick={load} aria-label="Refresh" title="Refresh" />
    </div>
  );

  const t = data?.totals;
  const s = data?.series ?? [];
  const daysAxis = s.map((d) => d.day);
  const live = t?.listings.byStatus.LIVE ?? 0;
  const f = data?.funnel;
  const mod = data?.moderation;
  const modActions = Object.entries(mod?.actions ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={data ? `Last ${data.periodDays} days · updated ${fmtDateTime(data.generatedAt)} · days in IST` : 'Marketplace health at a glance'}
        actions={periodSelector}
      />
      {error && <div style={{ marginBottom: '1rem' }}><ErrorBanner message={error} onRetry={load} /></div>}
      {!data && loading && <Loading label="Loading analytics…" />}
      {data && t && f && mod && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.85rem' }}>
            <Kpi label="Total users" value={fmtNum(t.users.total)} hint={`${fmtNum(t.users.active)} active`} to="/users" />
            <Kpi label="New users" value={fmtNum(t.users.newInPeriod)} hint={`in ${data.periodDays} days`} />
            <Kpi label="Signed in" value={fmtNum(t.users.signedInInPeriod)} hint={`in ${data.periodDays} days`} />
            <Kpi label="Live listings" value={fmtNum(live)} hint={`${fmtNum(t.listings.newInPeriod)} new in period`} to="/listings?status=LIVE" />
            <Kpi label="Verified live" value={fmtNum(t.listings.verifiedLive)} hint={live ? `${pct(t.listings.verifiedLive, live)} of live` : undefined} to="/listings?status=LIVE&verified=true" />
            <Kpi label="Offers" value={fmtNum(t.offersInPeriod)} hint="made in period" />
            <Kpi label="Deals" value={fmtNum(t.dealsInPeriod)} hint="offers accepted" />
            <Kpi label="Sold" value={fmtNum(t.soldInPeriod)} hint="listings marked sold" />
            <Kpi label="Messages" value={fmtNum(t.messagesInPeriod)} hint={`${fmtNum(t.conversationsInPeriod)} new chats`} />
            <Kpi
              label="Review queue"
              value={<span style={{ color: mod.queueSize > 0 ? toneText('warning') : undefined }}>{fmtNum(mod.queueSize)}</span>}
              hint={mod.queueSize > 0 ? 'waiting for review' : 'all clear'}
              to="/queue"
            />
            <Kpi
              label="Avg time to approve"
              value={mod.avgHoursToApprove == null ? '—' : `${mod.avgHoursToApprove < 10 ? mod.avgHoursToApprove.toFixed(1) : Math.round(mod.avgHoursToApprove)} h`}
              hint={`${fmtNum(mod.reviewedInPeriod)} reviewed in period`}
            />
          </div>

          <div className="adm-grid-2">
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

          <div className="adm-grid-2">
            <ChartCard title="Messages sent" subtitle="Per day" table={{ columns: ['Day', 'Messages'], rows: s.map((d) => [d.day, d.messages]) }}>
              <LineChart days={daysAxis} series={[{ key: 'm', label: 'Messages', color: SERIES_COLORS[0], values: s.map((d) => d.messages) }]} emptyText="No messages in this period" />
            </ChartCard>
            <ChartCard
              title="Listing funnel"
              subtitle={`Listings published in the last ${data.periodDays} days`}
              table={{
                columns: ['Stage', 'Listings', 'Of published', 'Of previous'],
                rows: [
                  ['Published', f.published, '100%', '—'],
                  ['Got an offer', f.withOffer, pct(f.withOffer, f.published), pct(f.withOffer, f.published)],
                  ['Deal agreed', f.withDeal, pct(f.withDeal, f.published), pct(f.withDeal, f.withOffer)],
                  ['Sold', f.sold, pct(f.sold, f.published), pct(f.sold, f.withDeal)],
                ],
              }}
            >
              <HBarChart
                emptyText="No listings published in this period"
                rows={[
                  { label: 'Published', value: f.published },
                  { label: 'Got an offer', value: f.withOffer, note: pct(f.withOffer, f.published) },
                  { label: 'Deal agreed', value: f.withDeal, note: pct(f.withDeal, f.withOffer) },
                  { label: 'Sold', value: f.sold, note: pct(f.sold, f.withDeal) },
                ]}
                valueSuffix={(r) => (r.note ? `${r.note} of previous` : undefined)}
              />
              {f.published > 0 && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
                  Overall: {pct(f.sold, f.published)} of published listings sold.
                </div>
              )}
            </ChartCard>
          </div>

          <div className="adm-grid-2">
            <ChartCard title="Live listings by city" subtitle="Right now" table={{ columns: ['City', 'Live listings'], rows: data.byCity.map((c) => [`${c.cityName} (${c.cityCode})`, c.count]) }}>
              <HBarChart rows={data.byCity.map((c) => ({ label: c.cityName, value: c.count }))} emptyText="No live listings" />
            </ChartCard>
            <ChartCard title="Live listings by category" subtitle="Top-level categories, right now" table={{ columns: ['Category', 'Live listings'], rows: data.byCategory.map((c) => [c.name, c.count]) }}>
              <HBarChart rows={data.byCategory.map((c) => ({ label: c.name, value: c.count }))} emptyText="No live listings" />
            </ChartCard>
          </div>

          <div className="adm-grid-2">
            <ChartCard title="Moderation actions" subtitle={`Staff actions in the last ${data.periodDays} days`} table={{ columns: ['Action', 'Count'], rows: modActions.map(([k, v]) => [humanize(k), v]) }}>
              <HBarChart rows={modActions.map(([k, v]) => ({ label: humanize(k), value: v }))} emptyText="No moderation actions in this period" />
            </ChartCard>
            <ChartCard
              title="Users by status"
              subtitle="All accounts"
              table={{ columns: ['Status', 'Users'], rows: Object.entries(t.users.byStatus).map(([k, v]) => [humanize(k), v]) }}
            >
              <HBarChart rows={Object.entries(t.users.byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: humanize(k), value: v }))} emptyText="No users yet" />
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
};
