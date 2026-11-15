import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi, tokenStore } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import { Copy, Check, ShieldCheck, Smartphone, Lock, Mail, Pencil, Heart, Bell, ChevronRight, LogOut, BadgeCheck, CalendarDays } from 'lucide-react';
import { Alert, PasswordChecklist, PasswordField, TextField } from '../../components/FormControls';
import { Avatar, Chip } from '../../components/ui';
import { ThemeSwitch } from '../../components/ThemeToggle';
import { MyListingItem, MyListingsPanel } from '../Marketplace/MyListings';
import { formatCompactINR, formatPrice } from '../../utils/format';
import {
  FieldErrors, fieldErrorsFrom, focusFirstError, formatIndianMobile, hasErrors, normalizeIndianMobile,
  validateConfirm, validateMobile, validateName, validatePassword,
} from '../../utils/validation';


const TrustChip: React.FC<{ ok: boolean; okLabel?: string; badLabel: string; badTone?: 'warning' | 'danger' | 'neutral' }> = ({ ok, okLabel = 'Verified', badLabel, badTone = 'warning' }) => (
  ok
    ? <Chip tone="success"><BadgeCheck size={12} /> {okLabel}</Chip>
    : <Chip tone={badTone}>{badLabel}</Chip>
);

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
  const allSet = verifiedAccount && !!user.emailVerifiedAt && !!user.phone;

  return (
    <section className="card card-pad" aria-labelledby="acc-profile-title">
      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar name={user.displayName} size="lg" />
          {verifiedAccount && (
            <span style={{ position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 99, background: 'var(--success-fill)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }} title="Verified account">
              <Check size={12} strokeWidth={3} />
            </span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          {!editingName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 id="acc-profile-title" style={{ fontSize: '1.2rem', fontWeight: 700, overflowWrap: 'anywhere' }}>{user.displayName}</h2>
              <Chip tone="primary" upper>{roleLabel}</Chip>
              <button type="button" onClick={() => { setEditingName(true); setNameMsg(null); }} className="icon-btn" aria-label="Edit name" title="Edit name" style={{ width: 30, height: 30, color: 'var(--text-muted)' }}>
                <Pencil size={15} />
              </button>
            </div>
          )}
          {editingName && <h2 id="acc-profile-title" className="sr-only">Profile</h2>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            {user.userCode && (
              <>
                <code className="chip chip-neutral chip-square" style={{ fontSize: '0.78rem', letterSpacing: '0.06em', fontWeight: 700 }} title="Your user code. Share it with Becho support; you can also sign in with it.">{user.userCode}</code>
                <button type="button" onClick={copyCode} aria-label="Copy user code" className="icon-btn" style={{ width: 30, height: 30, color: copied ? 'var(--success)' : 'var(--text-muted)' }}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
                {copied && <span role="status" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Copied</span>}
              </>
            )}
          </div>
        </div>
      </div>

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

      <div className="trust-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span className="overline" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Identity &amp; trust</span>
          {allSet ? <Chip tone="success"><ShieldCheck size={12} /> All set</Chip> : <Chip tone="warning">Action needed</Chip>}
        </div>
        <div className="trust-row">
          <Mail size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span className="tr-text" title={user.email ?? undefined}>{user.email ?? 'No email'}</span>
          {user.email && <TrustChip ok={!!user.emailVerifiedAt} badLabel="Not verified" />}
        </div>
        <div className="trust-row">
          <Smartphone size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span className="tr-text">{user.phone ? formatIndianMobile(user.phone) : 'Mobile number'}</span>
          {user.phone
            ? <TrustChip ok={!!user.phoneVerifiedAt} badLabel="On file" badTone="neutral" />
            : <Chip tone="danger">Not added</Chip>}
        </div>
        <div className="trust-row">
          <ShieldCheck size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <span className="tr-text">Account verification</span>
          {verifiedAccount ? <TrustChip ok badLabel="" /> : <Link to="/verify" className="chip chip-warning">Verify now</Link>}
        </div>
        {user.createdAt && (
          <div className="trust-row">
            <CalendarDays size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <span className="tr-text">Member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
          </div>
        )}
        {user.phone && !user.phoneVerifiedAt && (
          <div className="muted" style={{ fontSize: '0.74rem', marginTop: '2px' }}>To change your mobile number, contact support.</div>
        )}
      </div>

      {!user.phone && (
        <form onSubmit={saveMobile} noValidate className="remark-box warn" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '12px' }}>
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
  const [showPassword, setShowPassword] = useState(false);

  // Pick up changes made elsewhere (another tab, staff edits).
  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const loadListings = useCallback(() => {
    fetchApi<MyListingItem[]>('/listings/mine')
      .then((res) => { if (res.success && res.data) setListings(res.data); })
      .finally(() => setLoadingListings(false));
  }, []);
  useEffect(() => { loadListings(); }, [loadListings]);
  useEffect(() => {
    fetchApi<unknown[]>('/favorites').then((res) => { if (res.success && res.data) setSavedCount(res.data.length); });
  }, []);

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

  const live = listings.filter((l) => l.status === 'LIVE' || l.status === 'RESERVED').length;
  const sold = listings.filter((l) => l.status === 'SOLD');
  const soldValue = sold.reduce((sum, l) => sum + Number(l.price), 0);

  return (
    <>
      <Navbar />
      <main className="page">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div className="overline">Account &amp; trust center</div>
            <h1 className="page-title">My account</h1>
          </div>
          <ThemeSwitch />
        </div>

        <div className="acct-layout">
          <div className="acct-side">
            <div className="acct-profile-block"><ProfileSection user={user} /></div>

            <section className="acct-stats-block card" style={{ padding: '10px' }} aria-label="Your selling summary">
              <div className="stats-row">
                <div className="stat"><div className="stat-value">{loadingListings ? '–' : live}</div><div className="stat-label">Live ads</div></div>
                <div className="stat"><div className="stat-value">{loadingListings ? '–' : sold.length}</div><div className="stat-label">Sold</div></div>
                <div className="stat" title={soldValue ? `Total asking price of sold items: ${formatPrice(soldValue)}` : undefined}>
                  <div className="stat-value">{loadingListings ? '–' : formatCompactINR(soldValue)}</div>
                  <div className="stat-label">Total sold</div>
                </div>
              </div>
            </section>

            <section className="acct-support-block" aria-labelledby="acc-support-title">
              <h2 id="acc-support-title" className="section-title" style={{ marginBottom: '10px' }}>Account &amp; support</h2>
              <div className="card list-group">
                <Link to="/favorites" className="list-item">
                  <span className="li-icon"><Heart size={18} /></span>
                  <span style={{ flex: 1 }}>Saved ads</span>
                  {savedCount !== null && savedCount > 0 && <span className="chip chip-neutral">{savedCount}</span>}
                  <ChevronRight size={18} color="var(--text-muted)" />
                </Link>
                <div className="list-item">
                  <span className="li-icon"><Bell size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    Desktop alerts
                    <span className="muted" style={{ display: 'block', fontSize: '0.76rem' }}>
                      {desktopAlerts === 'granted' ? 'On — new messages and offers pop up even when Becho is in the background'
                        : desktopAlerts === 'denied' ? 'Blocked in your browser settings'
                          : desktopAlerts === 'unsupported' ? 'Not supported in this browser'
                            : 'Get alerted about messages and offers'}
                    </span>
                  </span>
                  {desktopAlerts === 'default' && <button type="button" className="btn btn-soft btn-sm" onClick={() => void enableDesktopAlerts()}>Turn on</button>}
                  {desktopAlerts === 'granted' && <Chip tone="success">On</Chip>}
                </div>
                <button type="button" className="list-item" onClick={() => setShowPassword((v) => !v)} aria-expanded={showPassword} aria-controls="change-password">
                  <span className="li-icon"><Lock size={18} /></span>
                  <span style={{ flex: 1 }}>Change password</span>
                  <ChevronRight size={18} color="var(--text-muted)" style={{ transform: showPassword ? 'rotate(90deg)' : undefined, transition: 'transform 0.15s' }} />
                </button>
                <button type="button" className="list-item danger" onClick={() => { logout(); navigate('/'); }}>
                  <span className="li-icon"><LogOut size={18} /></span>
                  <span style={{ flex: 1 }}>Sign out</span>
                  <ChevronRight size={18} />
                </button>
              </div>
              {showPassword && <div style={{ marginTop: '12px' }}><PasswordSection /></div>}
            </section>
          </div>

          <div className="acct-main">
            <div className="acct-listings-block">
              <MyListingsPanel listings={listings} loading={loadingListings} reload={loadListings} notice={notice} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
};
