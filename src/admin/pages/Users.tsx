import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Search, Users as UsersIcon, X } from 'lucide-react';
import { fetchApi } from '../../api/client';
import type { AdminUserRow, Pagination as PaginationT } from '../types';
import {
  Card, EmptyState, ErrorBanner, Loading, PageHeader, Pagination, Pill, UserStatusPill, apiError, fmtDate, fmtNum, fmtPhone,
  humanize, inputStyle, qs, selectStyle, timeAgo, useDebounced,
} from '../ui';

export const isLocked = (lockedUntil: string | null | undefined) => !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

/** Search box bound to the `search` URL param, debounced so typing doesn't spam the API. */
export const SearchBox: React.FC<{ placeholder: string; label: string }> = ({ placeholder, label }) => {
  const [params, setParams] = useSearchParams();
  const urlValue = params.get('search') ?? '';
  const [value, setValue] = useState(urlValue);
  const debounced = useDebounced(value, 300);

  useEffect(() => {
    // Keep the box in sync when the URL changes from elsewhere (back button, clear filters).
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
    <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 200, maxWidth: 420 }}>
      <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ ...inputStyle, paddingLeft: '2.1rem', paddingRight: value ? '2rem' : undefined }}
      />
      {value && (
        <button className="adm-btn" aria-label="Clear search" onClick={() => setValue('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
          <X size={15} />
        </button>
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
      style={selectStyle}
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

const PAGE_SIZE = 25;

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [page, setPage] = usePageParam();
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationT | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const role = params.get('role') ?? '';
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
  }, [query]);

  const hasFilters = !!(search || status || role);

  return (
    <div>
      <PageHeader title="Users" subtitle={pagination ? `${fmtNum(pagination.total)} account${pagination.total === 1 ? '' : 's'}${hasFilters ? ' match' : ''}` : 'Search and manage accounts'} />
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <SearchBox label="Search users" placeholder="Name, email, mobile or user code" />
        <ParamSelect name="status" label="Status" allLabel="All statuses" options={[['ACTIVE', 'Active'], ['PENDING_VERIFICATION', 'Unverified'], ['SUSPENDED', 'Suspended'], ['BANNED', 'Banned']]} />
        <ParamSelect name="role" label="Role" allLabel="All roles" options={[['USER', 'User'], ['MODERATOR', 'Moderator'], ['ADMIN', 'Admin']]} />
        <ParamSelect name="sort" label="Sort" defaultValue="newest" options={[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['last_login', 'Recently signed in'], ['name', 'Name A–Z']]} />
        {hasFilters && (
          <button className="adm-btn adm-link" style={{ fontSize: '0.85rem' }} onClick={() => setParams(sort !== 'newest' ? { sort } : {})}>
            Clear filters
          </button>
        )}
      </div>
      {error && <div style={{ marginBottom: '1rem' }}><ErrorBanner message={error} /></div>}
      <Card padding="0.5rem 0.75rem 0.85rem">
        {!users && loading ? (
          <Loading />
        ) : users && users.length === 0 ? (
          <EmptyState icon={<UsersIcon size={30} />} title="No users found">{hasFilters ? 'Try a different search or clear the filters.' : 'No accounts yet.'}</EmptyState>
        ) : (
          <div className="adm-table-wrap" style={{ opacity: loading ? 0.6 : 1 }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>User code</th>
                  <th>Name / email</th>
                  <th>Mobile</th>
                  <th>Status</th>
                  <th>Role</th>
                  <th className="adm-num">Listings</th>
                  <th>Joined</th>
                  <th>Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {users?.map((u) => (
                  <tr
                    key={u.id}
                    className="adm-row"
                    tabIndex={0}
                    onClick={() => navigate(`/users/${u.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/users/${u.id}`)}
                  >
                    <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{u.userCode}</td>
                    <td style={{ maxWidth: 260 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {u.displayName}
                        {isLocked(u.lockedUntil) && (
                          <span title={`Sign-in locked until ${new Date(u.lockedUntil!).toLocaleTimeString('en-IN')}`} aria-label="Sign-in locked" style={{ color: 'var(--warning)', display: 'inline-flex' }}>
                            <Lock size={13} />
                          </span>
                        )}
                      </span>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.email ?? ''}>{u.email ?? '—'}</div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtPhone(u.phone)}</td>
                    <td><UserStatusPill status={u.status} /></td>
                    <td>{u.role === 'USER' ? <span style={{ color: 'var(--text-secondary)' }}>User</span> : <Pill tone="accent">{humanize(u.role)}</Pill>}</td>
                    <td className="adm-num">{fmtNum(u._count.listings)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmtDate(u.createdAt)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={u.lastLoginAt ?? ''}>{timeAgo(u.lastLoginAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination pagination={pagination} onPage={setPage} noun="users" />
      </Card>
    </div>
  );
};
