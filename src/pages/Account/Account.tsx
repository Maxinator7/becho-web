import React, { useEffect, useState } from 'react';
import { fetchApi, tokenStore } from '../../api/client';
import { Navbar } from '../../components/Navbar';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { Copy, Check, ShieldCheck, UserCircle2, Smartphone, Lock, Mail, Pencil } from 'lucide-react';
import { Alert, PasswordChecklist, PasswordField, TextField, labelStyle } from '../../components/FormControls';
import {
  FieldErrors, fieldErrorsFrom, focusFirstError, formatIndianMobile, hasErrors, normalizeIndianMobile,
  validateConfirm, validateMobile, validateName, validatePassword,
} from '../../utils/validation';

const sectionTitle: React.CSSProperties = { fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' };
const secondaryBtn: React.CSSProperties = { padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.88rem' };

const Badge: React.FC<{ ok: boolean; children: React.ReactNode }> = ({ ok, children }) => {
  const color = ok ? 'var(--success)' : 'var(--warning)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {ok && <ShieldCheck size={12} />} {children}
    </span>
  );
};

const ReadOnlyRow: React.FC<{ label: string; icon: React.ReactNode; children: React.ReactNode }> = ({ label, icon, children }) => (
  <div>
    <div style={labelStyle}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', padding: '0.65rem 0.75rem', borderRadius: '8px', background: 'var(--surface-1)', border: '1px solid var(--border-color)' }}>
      {icon}{children}
    </div>
  </div>
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

  return (
    <section className="glass-panel" style={{ padding: '1.5rem' }} aria-labelledby="acc-profile-title">
      <h2 id="acc-profile-title" style={sectionTitle}><UserCircle2 size={20} color="var(--accent-primary)" /> Profile</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <ReadOnlyRow label="User code" icon={null}>
          <code style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text-primary)' }}>{user.userCode ?? '—'}</code>
          {user.userCode && (
            <button type="button" onClick={copyCode} aria-label="Copy user code" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: copied ? 'var(--success)' : 'var(--accent-primary)' }}>
              {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
            </button>
          )}
          <span style={{ flexBasis: '100%', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Share this with Becho support. You can also use it to sign in.</span>
        </ReadOnlyRow>

        {editingName ? (
          <form onSubmit={saveName} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <TextField
              id="acc-name" label="Name" autoComplete="name" maxLength={60} autoFocus value={name} error={nameError}
              onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-primary" disabled={savingName} style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}>{savingName ? 'Saving…' : 'Save name'}</button>
              <button type="button" style={secondaryBtn} onClick={() => { setEditingName(false); setNameError(undefined); setName(user.displayName); }}>Cancel</button>
            </div>
          </form>
        ) : (
          <ReadOnlyRow label="Name" icon={null}>
            <span style={{ fontWeight: 600 }}>{user.displayName}</span>
            <button type="button" onClick={() => { setEditingName(true); setNameMsg(null); }} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
              <Pencil size={14} /> Edit
            </button>
          </ReadOnlyRow>
        )}
        {nameMsg && <Alert tone={nameMsg.tone}>{nameMsg.text}</Alert>}

        <ReadOnlyRow label="Email" icon={<Mail size={16} color="var(--text-secondary)" />}>
          <span>{user.email ?? '—'}</span>
          {user.email && <Badge ok={!!user.emailVerifiedAt}>{user.emailVerifiedAt ? 'Verified' : 'Not verified'}</Badge>}
        </ReadOnlyRow>

        {user.phone ? (
          <ReadOnlyRow label="Mobile number" icon={<Smartphone size={16} color="var(--text-secondary)" />}>
            <span>{formatIndianMobile(user.phone)}</span>
            <span style={{ flexBasis: '100%', fontSize: '0.78rem', color: 'var(--text-muted)' }}>To change your mobile number, contact support.</span>
          </ReadOnlyRow>
        ) : (
          <form onSubmit={saveMobile} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem', borderRadius: '10px', border: '1px dashed color-mix(in srgb, var(--warning) 50%, transparent)', background: 'color-mix(in srgb, var(--warning) 6%, transparent)' }}>
            <TextField
              id="acc-mobile" label="Add your mobile number" type="tel" inputMode="numeric" autoComplete="tel-national" prefix="+91" maxLength={16}
              value={mobile} error={mobileError} placeholder="98765 43210"
              hint="Helps keep your account secure. You can sign in with it, and it isn't shown to buyers."
              onChange={(e) => { const v = e.target.value.replace(/[^\d\s+-]/g, ''); setMobile(v); if (mobileError) setMobileError(validateMobile(v)); }}
              onBlur={() => mobile && setMobileError(validateMobile(mobile))}
            />
            <div><button type="submit" className="btn-primary" disabled={savingMobile} style={{ padding: '0.55rem 1rem', fontSize: '0.88rem' }}>{savingMobile ? 'Saving…' : 'Save mobile number'}</button></div>
          </form>
        )}
        {mobileMsg && <Alert tone={mobileMsg.tone}>{mobileMsg.text}</Alert>}
      </div>
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
    <section className="glass-panel" style={{ padding: '1.5rem' }} aria-labelledby="acc-pw-title">
      <h2 id="acc-pw-title" style={sectionTitle}><Lock size={20} color="var(--accent-primary)" /> Change password</h2>
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
          <button type="submit" className="btn-primary" disabled={saving} aria-busy={saving} style={{ padding: '0.6rem 1.2rem', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </section>
  );
};

export const Account: React.FC = () => {
  const { user, refreshUser } = useAuth();
  // Pick up changes made elsewhere (another tab, staff edits).
  useEffect(() => { void refreshUser(); }, [refreshUser]);
  if (!user) return null;

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <Navbar />
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>Your account</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
        <ProfileSection user={user} />
        <PasswordSection />
      </div>
    </div>
  );
};
