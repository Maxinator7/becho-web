import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Lock, MousePointerClick, Users as UsersIcon, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { AdminUserRow, Analytics, Pagination as PaginationT } from '../types';
import { Button, Card, CopyButton, EmptyState, ErrorBanner, Loading, PageHeader, Pagination, Pill, UserStatusPill, apiError, fmtNum, fmtPhone, humanize, initials, qs } from '../ui';
import { ParamSelect, SearchBox, isLocked, usePageParam } from '../filters';
import { UserPanel } from './UserPanel';

const PAGE_SIZE = 25;

const HeaderStat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'danger' | 'success' }> = ({ label, value, hint, tone }) => (
  <div className="a-kpi" style={{ padding: '12px 14px', minWidth: 130 }}>
    <span className="a-kpi__label" style={{ fontSize: 12 }}>{label}</span>
    <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', color: tone === 'danger' ? 'var(--a-danger-text)' : undefined }}>{value}</span>
    {hint && <span className="a-small" style={{ color: tone === 'success' ? 'var(--a-success-text)' : 'var(--a-text-2)', fontWeight: 600 }}>{hint}</span>}
  </div>
);

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: selectedId } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = usePageParam();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [totals, setTotals] = useState<Analytics['totals']['users'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);

  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
  const verified = params.get('verified') ?? '';
  const sort = params.get('sort') ?? 'newest';
  const query = qs({ search, status, role, sort, page, limit: PAGE_SIZE });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchApi<{ users: AdminUserRow[]; pagination: PaginationT }>(`/admin/users${query}`).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success && res.data) {
        setUsers(res.data.users);
        setPagination(res.data.pagination);
      } else setError(apiError(res, 'Could not load users'));
    });
    return () => { cancelled = true; };
  }, [query, reload]);

  const loadTotals = useCallback(() => {
    fetchApi<Analytics>('/admin/analytics?days=30').then((res) => res.success && res.data && setTotals(res.data.totals.users));
  }, []);
  useEffect(loadTotals, [loadTotals]);

  // Verification filter is applied to the current page (the API has no verification filter).
  const shown = users?.filter((u) =>
    verified === 'both' ? !!u.emailVerifiedAt && !!u.phoneVerifiedAt : verified === 'missing' ? !u.emailVerifiedAt || !u.phoneVerifiedAt : true,
  );

  const hasFilters = !!(search || status || role || verified);
  const open = (id: string) => navigate({ pathname: `/users/${id}`, search: location.search });
  const close = () => navigate({ pathname: '/users', search: location.search });
  const blocked = totals ? (totals.byStatus.SUSPENDED ?? 0) + (totals.byStatus.BANNED ?? 0) : 0;

  return (
    <div>
      <PageHeader
        overline="Trust & safety"
        title="User management & verification"
        subtitle="Search any account by user code, mobile, email or name. Open a user to review their checks, history and notes."
        actions={
          totals && (
            <div className="a-row" style={{ gap: 10, alignItems: 'stretch' }}>
              <HeaderStat label="Total users" value={fmtNum(totals.total)} hint={`+${fmtNum(totals.newInPeriod)} in 30 days`} tone="success" />
              <HeaderStat label="Active" value={fmtNum(totals.active)} hint={`${totals.total ? Math.round((totals.active / totals.total) * 100) : 0}% of accounts`} />
              <HeaderStat label="Unverified" value={fmtNum(totals.byStatus.PENDING_VERIFICATION ?? 0)} hint="pending verification" />
              <HeaderStat label="Suspended / banned" value={fmtNum(blocked)} hint={blocked ? 'blocked accounts' : 'none'} tone={blocked ? 'danger' : undefined} />
            </div>
          )
        }
      />

      <div className="a-md">
        <div className="a-stack" style={{ minWidth: 0 }}>
          <Card>
            <div className="a-toolbar">
              <SearchBox label="Search users" placeholder="Search by user code (BCH-…), mobile, email or name" width={340} />
            </div>
            <div className="a-toolbar" style={{ marginTop: 12 }}>
              <span className="a-small a-text-2" style={{ fontWeight: 600 }}>Filter by:</span>
              <ParamSelect name="verified" label="Verification" allLabel="Verification: all" options={[['both', 'Email & mobile verified'], ['missing', 'Missing a verification']]} />
              <ParamSelect name="status" label="Status" allLabel="Status: all accounts" options={[['ACTIVE', 'Active'], ['PENDING_VERIFICATION', 'Unverified'], ['SUSPENDED', 'Suspended'], ['BANNED', 'Banned']]} />
              <ParamSelect name="role" label="Role" allLabel="Role: all" options={[['USER', 'User'], ['MODERATOR', 'Moderator'], ['ADMIN', 'Admin']]} />
              <ParamSelect name="sort" label="Sort" defaultValue="newest" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['last_login', 'Recently signed in'], ['name', 'Name A–Z']]} />
              {hasFilters && (
                <Button variant="ghost" small icon={<X size={14} />} onClick={() => setParams(sort !== 'newest' ? { sort } : {})}>Clear filters</Button>
              )}
            </div>
            {verified && <div className="a-small a-muted" style={{ marginTop: 8 }}>Verification filter applies to the users on this page.</div>}
          </Card>

          {error && <ErrorBanner message={error} />}

          <Card flush>
            {!users && loading ? (
              <Loading />
            ) : shown && shown.length === 0 ? (
              <EmptyState icon={<UsersIcon size={30} />} title="No users found">{hasFilters ? 'Try a different search or clear the filters.' : 'No accounts yet.'}</EmptyState>
            ) : (
              <div className="a-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
                <table className="a-table a-table--dense">
                  <thead>
                    <tr>
                      <th>User &amp; code</th>
                      <th>Contact &amp; verification</th>
                      <th className="a-th-num">Listings</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown?.map((u) => (
                      <tr
                        key={u.id}
                        className="a-tr-link"
                        tabIndex={0}
                        aria-selected={u.id === selectedId}
                        onClick={() => open(u.id)}
                        onKeyDown={(e) => e.key === 'Enter' && open(u.id)}
                      >
                        <td style={{ minWidth: 180 }}>
                          <div className="a-row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                            <span className={`a-avatar${u.role === 'USER' ? ' a-avatar--soft' : ''}`} aria-hidden>{initials(u.displayName)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="a-row" style={{ gap: 4, fontWeight: 700, flexWrap: 'nowrap' }}>
                                <span className="a-ellipsis">{u.displayName}</span>
                                {isLocked(u.lockedUntil) && (
                                  <span title={`Sign-in locked until ${new Date(u.lockedUntil!).toLocaleTimeString('en-IN')}`} aria-label="Sign-in locked" style={{ color: 'var(--a-warning-text)', display: 'inline-flex' }}>
                                    <Lock size={13} />
                                  </span>
                                )}
                              </div>
                              <div className="a-row" style={{ gap: 2 }} onClick={(e) => e.stopPropagation()}>
                                <span className="a-chip a-chip--mono" style={{ padding: '0 6px' }}>{u.userCode}</span>
                                <CopyButton value={u.userCode} label="Copy user code" />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="a-stack" style={{ gap: 2 }}>
                            <span className="a-row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              <span style={{ whiteSpace: 'nowrap' }}>{fmtPhone(u.phone)}</span>
                              {u.phone && (
                                <span className={`a-check ${u.phoneVerifiedAt ? 'a-check--ok' : 'a-check--no'}`} title={u.phoneVerifiedAt ? 'Mobile verified' : 'Mobile not verified'}>
                                  {u.phoneVerifiedAt ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}<span className="a-sr">{u.phoneVerifiedAt ? 'verified' : 'not verified'}</span>
                                </span>
                              )}
                            </span>
                            <span className="a-row a-small a-text-2" style={{ gap: 6, flexWrap: 'nowrap' }}>
                              <span className="a-ellipsis" style={{ maxWidth: 170 }} title={u.email ?? ''}>{u.email ?? '—'}</span>
                              {u.email && (
                                <span className={`a-check ${u.emailVerifiedAt ? 'a-check--ok' : 'a-check--no'}`} title={u.emailVerifiedAt ? 'Email verified' : 'Email not verified'}>
                                  {u.emailVerifiedAt ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}<span className="a-sr">{u.emailVerifiedAt ? 'verified' : 'not verified'}</span>
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="a-td-num">
                          <div style={{ fontWeight: 600 }}>{fmtNum(u._count.listings)}</div>
                        </td>
                        <td>
                          <div className="a-stack" style={{ gap: 4, alignItems: 'flex-start' }}>
                            <UserStatusPill status={u.status} />
                            {u.role !== 'USER' && <Pill tone="accent">{humanize(u.role)}</Pill>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination pagination={pagination} onPage={setPage} noun="users" />
          </Card>
        </div>

        <aside className="a-md__panel" aria-label="User profile">
          {selectedId ? (
            <UserPanel id={selectedId} onClose={close} onChanged={() => { setReload((n) => n + 1); loadTotals(); }} />
          ) : (
            <Card className="a-md__placeholder">
              <EmptyState icon={<MousePointerClick size={28} />} title="Select a user">
                Pick a row to see identity checks, listings, the audit timeline and staff notes.
              </EmptyState>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
};
