import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi, tokenStore } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import {
  ArrowRight, BadgeCheck, Bell, Check, ChevronRight, Copy, Handshake, Heart, List, Lock, LogOut, MessageSquare, Palette, Pencil, PlusCircle,
} from 'lucide-react';
import { Alert, PasswordChecklist, PasswordField, TextField } from '../../components/FormControls';
import { Avatar, Chip, ListingCard, ListingCardData } from '../../components/ui';
import { ThemeSwitch } from '../../components/ThemeToggle';
import { MyListingItem, MyListingsPanel } from '../Marketplace/MyListings';
import {
  FieldErrors, fieldErrorsFrom, focusFirstError, formatIndianMobile, hasErrors, normalizeIndianMobile,
  validateConfirm, validateMobile, validateName, validatePassword,
} from '../../utils/validation';


/* ───────────── profile (name, user code, email, mobile) ───────────── */

const ProfileSection: React.FC<{ user: UserProfile }> = ({ user }) => {
  const { updateUser, refreshUser } = useAuth();
  const [copied, setCopied] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(user.displayName);
  const [nameError, setNameError] = useState<string | undefined>();
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const [mobile, setMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | undefined>();
  const [savingMobile, setSavingMobile] = useState(false);
  const [mobileMsg, setMobileMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => { if (!editingName) setName(user.displayName); }, [user.displayName, editingName]);

  const copyCode = async () => {
    if (!user.userCode) return;
    try {
      await navigator.clipboard.writeText(user.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked: the code is still visible to copy by hand */ }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().replace(/\s+/g, ' ');
    setName(trimmed);
    const err = validateName(trimmed);
    setNameError(err);
    if (err) { document.getElementById('acc-name')?.focus(); return; }
    if (trimmed === user.displayName) { setEditingName(false); return; }
    setSavingName(true);
    setNameMsg(null);
    const res = await fetchApi<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify({ displayName: trimmed }) });
    setSavingName(false);
    if (res.success && res.data) {
      updateUser(res.data);
      void refreshUser();
      setEditingName(false);
      setNameMsg({ tone: 'success', text: 'Name updated.' });
    } else {
      const fe = fieldErrorsFrom(res, ['name'] as const, { displayName: 'name' });
      if (fe.name) setNameError(fe.name);
      else setNameMsg({ tone: 'danger', text: res.error?.message || 'Could not update your name.' });
    }
  };

  const saveMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateMobile(mobile);
    setMobileError(err);
    if (err) { document.getElementById('acc-mobile')?.focus(); return; }
    setSavingMobile(true);
    setMobileMsg(null);
    const res = await fetchApi<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify({ phone: `+91${normalizeIndianMobile(mobile)}` }) });
    setSavingMobile(false);
    if (res.success && res.data) {
      updateUser(res.data);
      void refreshUser();
      setMobile('');
      setMobileMsg({ tone: 'success', text: 'Mobile number added. You can now sign in with it too.' });
      return;
    }
    if (res.error?.code === 'PHONE_TAKEN') {
      setMobileError('This mobile number is already registered to another account.');
      document.getElementById('acc-mobile')?.focus();
      return;
    }
    const fe = fieldErrorsFrom(res, ['mobile'] as const, { phone: 'mobile' });
    if (fe.mobile) setMobileError(fe.mobile);
    else setMobileMsg({ tone: 'danger', text: res.error?.message || 'Could not save your mobile number.' });
  };

  const roleLabel = user.role === 'ADMIN' ? 'Admin' : user.role === 'MODERATOR' ? 'Moderator' : 'Member';
  const verifiedAccount = user.status === 'ACTIVE';

  return (
    <section className="card card-pad profile-card" aria-labelledby="acc-profile-title">
      <div className="pc-avatar">
        <Avatar name={user.displayName} size="lg" />
        {verifiedAccount && (
          <span className="pc-check" title="Verified account"><Check size={12} strokeWidth={3} /></span>
        )}
      </div>
      {!editingName && (
        <div className="pc-name">
          <h2 id="acc-profile-title">{user.displayName}</h2>
          <button type="button" onClick={() => { setEditingName(true); setNameMsg(null); }} className="icon-btn" aria-label="Edit name" title="Edit name" style={{ width: 30, height: 30, color: 'var(--text-muted)' }}>
            <Pencil size={15} />
          </button>
        </div>
      )}
      {editingName && <h2 id="acc-profile-title" className="sr-only">Profile</h2>}
      {user.userCode && (
        <div className="pc-code">
          <code title="Your user code. Share it with Becho support; you can also sign in with it.">{user.userCode}</code>
          <button type="button" onClick={copyCode} aria-label="Copy user code" className="icon-btn" style={{ width: 28, height: 28, color: copied ? 'var(--success)' : 'var(--text-muted)' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          {copied && <span role="status" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Copied</span>}
        </div>
      )}
      <div className="pc-chips">
        {user.emailVerifiedAt && <span className="ok-pill"><BadgeCheck size={13} /> Email verified</span>}
        {user.phoneVerifiedAt && <span className="ok-pill"><BadgeCheck size={13} /> Mobile verified</span>}
        {!verifiedAccount && <Link to="/verify" className="chip chip-warning">Verify your account</Link>}
        {roleLabel !== 'Member' && <Chip tone="primary" upper>{roleLabel}</Chip>}
      </div>
      {user.createdAt && (
        <div className="pc-facts">
          <span className="muted">Member since</span>
          <span>{new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</span>
        </div>
      )}

      {editingName && (
        <form onSubmit={saveName} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '14px' }}>
          <TextField
            id="acc-name" label="Name" autoComplete="name" maxLength={60} autoFocus value={name} error={nameError}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn-primary btn-sm" disabled={savingName}>{savingName ? 'Saving…' : 'Save name'}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setEditingName(false); setNameError(undefined); setName(user.displayName); }}>Cancel</button>
          </div>
        </form>
      )}
      {nameMsg && <Alert tone={nameMsg.tone} style={{ marginTop: '10px' }}>{nameMsg.text}</Alert>}

      {!user.phone && (
        <form id="add-mobile" onSubmit={saveMobile} noValidate className="remark-box warn" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '12px', textAlign: 'left' }}>
          <TextField
            id="acc-mobile" label="Add your mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" prefix="+91" maxLength={16}
            value={mobile} error={mobileError} placeholder="98765 43210"
            hint="Helps keep your account secure. You can sign in with it, and it isn't shown to buyers."
            onChange={(e) => { const v = e.target.value.replace(/[^\d\s+-]/g, ''); setMobile(v); if (mobileError) setMobileError(validateMobile(v)); }}
            onBlur={() => mobile && setMobileError(validateMobile(mobile))}
          />
          <div><button type="submit" className="btn-primary btn-sm" disabled={savingMobile}>{savingMobile ? 'Saving…' : 'Save mobile number'}</button></div>
        </form>
      )}
      {mobileMsg && <Alert tone={mobileMsg.tone} style={{ marginTop: '10px' }}>{mobileMsg.text}</Alert>}
    </section>
  );
};

/* ───────────── change password ───────────── */

type PwField = 'current' | 'password' | 'confirm';
const PW_FIELDS: PwField[] = ['current', 'password', 'confirm'];

const PasswordSection: React.FC = () => {
  const [values, setValues] = useState<Record<PwField, string>>({ current: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors<PwField>>({});
  const [touched, setTouched] = useState<Partial<Record<PwField, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const validators: Record<PwField, (v: Record<PwField, string>) => string | undefined> = {
    current: (v) => (v.current ? undefined : 'Enter your current password'),
    password: (v) => validatePassword(v.password) ?? (v.password === v.current ? 'New password must be different from the current one' : undefined),
    confirm: (v) => validateConfirm(v.password, v.confirm),
  };

  const set = (f: PwField, value: string) => {
    const next = { ...values, [f]: value };
    setValues(next);
    setErrors((e) => {
      const out = { ...e };
      for (const k of PW_FIELDS) if (touched[k]) out[k] = validators[k](next);
      return out;
    });
  };
  const blur = (f: PwField) => {
    setTouched((t) => ({ ...t, [f]: true }));
    setErrors((e) => ({ ...e, [f]: validators[f](values) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setMsg(null);
    const next: FieldErrors<PwField> = {};
    for (const f of PW_FIELDS) next[f] = validators[f](values);
    setErrors(next);
    setTouched({ current: true, password: true, confirm: true });
    if (hasErrors(next)) { focusFirstError(next, PW_FIELDS, 'pw-'); return; }

    setSaving(true);
    const res = await fetchApi<{ message: string }>('/auth/change-password', {
      method: 'POST',
      // Passing this session's refresh token keeps this browser signed in.
      body: JSON.stringify({ currentPassword: values.current, newPassword: values.password, refreshToken: tokenStore.refresh ?? undefined }),
    });
    setSaving(false);
    if (res.success) {
      setValues({ current: '', password: '', confirm: '' });
      setTouched({});
      setErrors({});
      setMsg({ tone: 'success', text: 'Password changed. Other devices have been signed out.' });
      return;
    }
    if (res.error?.code === 'INVALID_CURRENT_PASSWORD') {
      setErrors({ current: 'Your current password is incorrect.' });
      setValues((v) => ({ ...v, current: '' }));
      focusFirstError({ current: 'x' }, PW_FIELDS, 'pw-');
      return;
    }
    const fe = fieldErrorsFrom(res, PW_FIELDS, { currentPassword: 'current', newPassword: 'password' });
    if (hasErrors(fe)) { setErrors(fe); focusFirstError(fe, PW_FIELDS, 'pw-'); return; }
    setMsg({ tone: 'danger', text: res.error?.message || 'Could not change your password.' });
  };

  return (
    <section id="change-password" className="card card-pad" aria-labelledby="acc-pw-title">
      <h2 id="acc-pw-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '1rem' }}><Lock size={18} color="var(--primary-text)" /> Change password</h2>
      {msg && <Alert tone={msg.tone} style={{ marginBottom: '1rem' }}>{msg.text}</Alert>}
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <PasswordField id="pw-current" label="Current password" autoComplete="current-password" value={values.current}
          onChange={(e) => set('current', e.target.value)} onBlur={() => blur('current')} error={errors.current} />
        <PasswordField id="pw-password" label="New password" autoComplete="new-password" maxLength={128} value={values.password}
          onChange={(e) => set('password', e.target.value)} onBlur={() => blur('password')} error={errors.password}>
          <PasswordChecklist password={values.password} />
        </PasswordField>
        <PasswordField id="pw-confirm" label="Confirm new password" autoComplete="new-password" maxLength={128} value={values.confirm}
          onChange={(e) => set('confirm', e.target.value)} onBlur={() => blur('confirm')} error={errors.confirm} />
        <div>
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving} style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  );
};

export const Account: React.FC<{ section?: 'listings' }> = ({ section }) => {
  const { user, refreshUser, logout } = useAuth();
  const { desktopAlerts, enableDesktopAlerts } = useNotifications();
  const navigate = useNavigate();
  const notice = ((useRouterLocation().state || {}) as { notice?: string }).notice;
  const [listings, setListings] = useState<MyListingItem[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [saved, setSaved] = useState<ListingCardData[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Pick up changes made elsewhere (another tab, staff edits).
  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const loadListings = useCallback(() => {
    fetchApi<MyListingItem[]>('/listings/mine')
      .then((res) => { if (res.success && res.data) setListings(res.data); })
      .finally(() => setLoadingListings(false));
  }, []);
  useEffect(() => { loadListings(); }, [loadListings]);
  const loadSaved = useCallback(() => {
    fetchApi<ListingCardData[]>('/favorites').then((res) => { if (res.success && res.data) { setSaved(res.data); setSavedCount(res.data.length); } });
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);
  const toggleFavorite = async (id: string) => {
    await fetchApi(`/favorites/${id}`, { method: 'POST' });
    loadSaved();
  };

  // /my-listings opens this page at the listings section.
  useEffect(() => {
    if (section === 'listings' && !loadingListings && window.matchMedia('(max-width: 960px)').matches) {
      document.getElementById('my-listings')?.scrollIntoView({ block: 'start' });
    }
  }, [section, loadingListings]);

  useEffect(() => {
    if (showPassword) document.getElementById('change-password')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showPassword]);

  if (!user) return null;

  const activeCount = listings.filter((l) => l.status === 'LIVE').length;
  const reservedCount = listings.filter((l) => l.status === 'RESERVED').length;
  const soldCount = listings.filter((l) => l.status === 'SOLD').length;
  const stat = (n: number) => (loadingListings ? '–' : n);

  const menu = (
    <nav className="card acct-menu" aria-label="Account">
      <Link to="/my-listings" className={`am-item${section === 'listings' ? ' on' : ''}`} onClick={() => document.getElementById('my-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
        <List size={18} /> <span>My listings</span> {!loadingListings && <span className="am-count primary">{listings.length}</span>}
      </Link>
      <Link to="/favorites" className="am-item"><Heart size={18} /> <span>Saved ads</span> {savedCount !== null && savedCount > 0 && <span className="am-count">{savedCount}</span>}</Link>
      <Link to="/chat" className="am-item"><MessageSquare size={18} /> <span>Messages</span></Link>
      <div className="am-item static">
        <Bell size={18} />
        <span style={{ minWidth: 0 }}>
          Notification preferences
          <span className="muted am-sub">
            {desktopAlerts === 'granted' ? 'Desktop alerts are on'
              : desktopAlerts === 'denied' ? 'Desktop alerts blocked in browser settings'
                : desktopAlerts === 'unsupported' ? 'Desktop alerts not supported here'
                  : 'Desktop alerts for messages and offers'}
          </span>
        </span>
        {desktopAlerts === 'default' && <button type="button" className="btn btn-soft btn-sm" onClick={() => void enableDesktopAlerts()}>Turn on</button>}
        {desktopAlerts === 'granted' && <Chip tone="success">On</Chip>}
      </div>
      <button type="button" className="am-item" onClick={() => setShowPassword((v) => !v)} aria-expanded={showPassword} aria-controls="change-password">
        <Lock size={18} /> <span>Security & password</span>
        <ChevronRight size={16} className="muted" style={{ transform: showPassword ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
      </button>
      <div className="am-item static">
        <Palette size={18} /> <span>Theme</span> <ThemeSwitch />
      </div>
      <div className="am-phone">
        <span className="overline">Primary phone</span>
        {user.phone
          ? <span className="am-phone-num">{formatIndianMobile(user.phone)} {user.phoneVerifiedAt ? <BadgeCheck size={14} color="var(--success)" aria-label="Verified" /> : <span className="muted" style={{ fontSize: '0.75rem' }}>(on file)</span>}</span>
          : <a href="#add-mobile" className="link" style={{ fontSize: '0.88rem' }}>Add a mobile number</a>}
      </div>
      <button type="button" className="am-item danger" onClick={() => { logout(); navigate('/'); }}>
        <LogOut size={18} /> <span>Log out</span>
      </button>
    </nav>
  );

  return (
    <>
      <Navbar />
      <main className="page acct-v2">
        <nav className="crumbs desktop-only" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">My account & listings</span>
        </nav>

        <div className="acct-layout v2">
          <aside className="acct-side">
            <div className="acct-profile-block"><ProfileSection user={user} /></div>
            <div className="acct-menu-block">
              {menu}
              {showPassword && <div style={{ marginTop: '12px' }}><PasswordSection /></div>}
              <div className="acct-tip">
                <Handshake size={18} />
                <div>
                  <strong>Deal hand-to-hand</strong>
                  <span>Inspect items in person and in daylight before any money changes hands.</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="acct-main">
            <section className="card acct-stats" aria-label="Your selling summary">
              <div className="st-tile"><span className="st-label">Active listings</span><span className="st-val">{stat(activeCount)} <small>ads live</small></span></div>
              <div className="st-tile accent"><span className="st-label">Reserved deals</span><span className="st-val">{stat(reservedCount)} <small>pending</small></span></div>
              <div className="st-tile"><span className="st-label">Items sold</span><span className="st-val">{stat(soldCount)} <small>total</small></span></div>
              <Link to="/create-listing" className="btn-primary btn-lg st-post"><PlusCircle size={19} /> Post new ad</Link>
            </section>

            <div className="acct-listings-block">
              <MyListingsPanel listings={listings} loading={loadingListings} reload={loadListings} notice={notice} />
            </div>

            {saved.length > 0 && (
              <section className="card saved-box" aria-labelledby="saved-title">
                <div className="section-head" style={{ alignItems: 'center', marginBottom: 14 }}>
                  <h2 id="saved-title" className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Heart size={20} fill="currentColor" color="var(--danger-fill)" /> Saved ads <span className="count-chip">{saved.length} item{saved.length === 1 ? '' : 's'}</span>
                  </h2>
                  <Link to="/favorites" className="link" style={{ fontSize: '0.88rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>View all saved <ArrowRight size={15} /></Link>
                </div>
                <div className="listing-grid saved-grid">
                  {saved.slice(0, 3).map((item) => <ListingCard key={item.id} item={item} favorited onToggleFavorite={toggleFavorite} />)}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
};
