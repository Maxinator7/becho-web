import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Package, Search, User } from 'lucide-react';
import { fetchApi } from '../api/client';
import { formatPrice } from '../utils/format';
import type { AdminListingRow, AdminUserRow } from './types';
import { ListingStatusPill, UserStatusPill, fmtPhone, qs, useDebounced } from './ui';

type Option =
  | { kind: 'user'; id: string; user: AdminUserRow }
  | { kind: 'listing'; id: string; listing: AdminListingRow }
  | { kind: 'all-users' | 'all-listings'; id: string };

/** Looks like a user code, mobile or email → users are the likelier target. */
const looksLikeUser = (q: string) => /^bch-/i.test(q) || /^[\d\s+-]{6,}$/.test(q) || q.includes('@');

/**
 * Header search across users (name, email, mobile, user code) and listings
 * (title, description, seller name/code). Shows the top matches of each and
 * "see all" shortcuts to the filtered Users / Listings pages.
 */
export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [listings, setListings] = useState<AdminListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const term = useDebounced(q.trim(), 250);

  useEffect(() => {
    if (term.length < 2) {
      setUsers([]);
      setListings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchApi<{ users: AdminUserRow[] }>(`/admin/users${qs({ search: term, limit: 4 })}`),
      fetchApi<{ listings: AdminListingRow[] }>(`/admin/listings${qs({ search: term, limit: 4 })}`),
    ]).then(([u, l]) => {
      if (cancelled) return;
      setLoading(false);
      setUsers(u.success && u.data ? u.data.users : []);
      setListings(l.success && l.data ? l.data.listings : []);
      setActive(0);
    });
    return () => { cancelled = true; };
  }, [term]);

  // "/" focuses the search (when not typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const trimmed = q.trim();
  const userFirst = looksLikeUser(trimmed);
  const userOpts: Option[] = [...users.map((u) => ({ kind: 'user' as const, id: `u-${u.id}`, user: u })), { kind: 'all-users', id: 'all-users' }];
  const listingOpts: Option[] = [...listings.map((l) => ({ kind: 'listing' as const, id: `l-${l.id}`, listing: l })), { kind: 'all-listings', id: 'all-listings' }];
  const groups: [string, Option[]][] = userFirst ? [['Users', userOpts], ['Listings', listingOpts]] : [['Listings', listingOpts], ['Users', userOpts]];
  const options = groups.flatMap(([, o]) => o);
  const showPop = open && trimmed.length > 0;

  const choose = (o: Option) => {
    const s = encodeURIComponent(trimmed);
    if (o.kind === 'user') navigate(`/users/${o.user.id}`);
    else if (o.kind === 'listing') navigate(`/listings/${o.listing.id}`);
    else if (o.kind === 'all-users') navigate(`/users?search=${s}`);
    else navigate(`/listings?search=${s}`);
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && trimmed) { e.preventDefault(); choose(options[Math.min(active, options.length - 1)]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className="a-gsearch a-hide-sm" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOpen(false)}>
      <div className="a-gsearch__box">
        {loading ? <Loader2 size={16} className="a-spin" /> : <Search size={16} />}
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label="Search users and listings"
          aria-expanded={showPop}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPop && options[active] ? `${listId}-${options[active].id}` : undefined}
          placeholder="Search users by code, mobile or name — or listings…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="a-chip a-chip--mono" style={{ fontSize: 11, padding: '0 6px' }} aria-hidden>/</kbd>
      </div>
      {showPop && (
        <div className="a-gsearch__pop" role="listbox" id={listId} aria-label="Search results">
          {groups.map(([label, opts]) => (
            <div key={label} role="group" aria-label={label}>
              <div className="a-gsearch__group">{label}</div>
              {opts.length === 1 && term.length >= 2 && !loading && (
                <div className="a-gsearch__empty">No {label.toLowerCase()} match “{trimmed}”.</div>
              )}
              {opts.map((o) => {
                const idx = options.indexOf(o);
                return (
                  <div
                    key={o.id}
                    id={`${listId}-${o.id}`}
                    role="option"
                    aria-selected={idx === active}
                    className="a-gsearch__opt"
                    tabIndex={-1}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(o)}
                  >
                    {o.kind === 'user' && (
                      <>
                        <User size={15} className="a-muted" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="a-ellipsis" style={{ fontWeight: 600 }}>{o.user.displayName}</div>
                          <div className="a-ellipsis a-muted" style={{ fontSize: 12 }}>
                            <span className="a-mono">{o.user.userCode}</span> · {o.user.phone ? fmtPhone(o.user.phone) : o.user.email ?? '—'}
                          </div>
                        </div>
                        <UserStatusPill status={o.user.status} />
                      </>
                    )}
                    {o.kind === 'listing' && (
                      <>
                        <Package size={15} className="a-muted" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="a-ellipsis" style={{ fontWeight: 600 }}>{o.listing.title}</div>
                          <div className="a-ellipsis a-muted" style={{ fontSize: 12 }}>
                            {formatPrice(o.listing.price)} · {o.listing.seller.displayName} · {o.listing.cityCode}
                          </div>
                        </div>
                        <ListingStatusPill status={o.listing.status} />
                      </>
                    )}
                    {(o.kind === 'all-users' || o.kind === 'all-listings') && (
                      <>
                        <ArrowRight size={15} className="a-muted" />
                        <span style={{ flex: 1 }}>
                          All {o.kind === 'all-users' ? 'users' : 'listings'} matching <strong>“{trimmed}”</strong>
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
