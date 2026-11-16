import React, { useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, Store } from 'lucide-react';
import { AuthTokens, fetchApi } from '../api/client';
import { UserProfile, useAuth } from '../context/AuthContext';
import { Button } from './ui';
import { AdminThemeToggle } from './chrome';

export const STAFF_ROLES = ['ADMIN', 'MODERATOR'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_RE = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/;
const CODE_RE = /^BCH-[A-Z0-9]{6}$/i;

/** Staff sign in with email, mobile or user code. Returns an error message or null. */
function validateIdentifier(v: string): string | null {
  const s = v.trim();
  if (!s) return 'Enter your email, mobile number or user code.';
  if (s.includes('@')) return EMAIL_RE.test(s) ? null : 'Enter a valid email address.';
  if (/^[\d\s+-]+$/.test(s)) return MOBILE_RE.test(s) ? null : 'Enter a valid 10-digit Indian mobile number.';
  if (CODE_RE.test(s)) return null;
  return 'Enter a valid email, mobile number or user code (BCH-XXXXXX).';
}

function validateNewPassword(p: string): string | null {
  if (!p) return 'Enter a new password.';
  if (p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Include at least one letter and one number.';
  return null;
}

const FieldError: React.FC<{ id: string; msg?: string | null }> = ({ id, msg }) =>
  msg ? <div id={id} className="a-field-err">{msg}</div> : null;

const Alert: React.FC<{ tone: 'danger' | 'success' | 'info'; children: React.ReactNode }> = ({ tone, children }) => (
  <div role={tone === 'danger' ? 'alert' : 'status'} className={`a-banner a-banner--${tone}`} style={{ marginBottom: 18 }}>
    {tone === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
    <div>{children}</div>
  </div>
);

const PasswordInput: React.FC<{ id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string; onBlur?: () => void; autoFocus?: boolean }> = ({ id, value, onChange, autoComplete, invalid, describedBy, onBlur, autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="a-pw a-input-wrap">
      <Lock size={16} />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="a-input a-input--soft"
        style={{ height: 44 }}
      />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
};

const Shell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="a-login">
    <div className="a-login__theme"><AdminThemeToggle /></div>
    <main className="a-login__main">
      <div className="a-login__mark">
        <span className="a-login__logo" aria-hidden><Store size={20} /></span>
        <span className="a-login__word">becho<span className="a-login__dot">.</span></span>
        <span className="a-login__badge">Admin portal</span>
      </div>
      <h1 className="a-login__title">{title}</h1>
      <p className="a-login__sub">{subtitle}</p>
      <div className="a-login__card">{children}</div>
      <p className="a-login__foot">Internal staff access only · Becho Classifieds India</p>
    </main>
  </div>
);

const field: React.CSSProperties = { display: 'flex', flexDirection: 'column' };

/* ------------------------------------------------------------------ */

const SignIn: React.FC<{ onForgot: (identifier: string) => void; notice: string | null }> = ({ onForgot, notice }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ id?: boolean; pw?: boolean }>({});
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const idError = fieldErrors.identifier || validateIdentifier(identifier);
  const pwError = fieldErrors.password || (password ? null : 'Enter your password.');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ id: true, pw: true });
    setFieldErrors({});
    if (validateIdentifier(identifier) || !password) return;
    setLoading(true);
    setError(null);
    const res = await fetchApi<{ tokens: AuthTokens; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifier.trim(), password }),
    });
    setLoading(false);
    if (!res.success || !res.data) {
      const code = res.error?.code;
      if (code === 'VALIDATION_ERROR' && res.error?.details?.length) {
        const fe: Record<string, string> = {};
        res.error.details.forEach((d) => { fe[d.path] = d.message; });
        setFieldErrors(fe);
        return;
      }
      setError(
        code === 'INVALID_CREDENTIALS' ? 'Incorrect email/mobile/user code or password.'
        : code === 'ACCOUNT_LOCKED' ? (res.error?.message || 'Too many wrong passwords. Try again later.')
        : code === 'ACCOUNT_SUSPENDED' || code === 'ACCOUNT_BANNED' ? (res.error?.message || 'This account has been blocked.')
        : res.error?.message || 'Sign in failed. Please try again.',
      );
      return;
    }
    if (!STAFF_ROLES.includes(res.data.user.role)) {
      setError('This account does not have access to the admin portal.');
      return;
    }
    login(res.data.tokens, res.data.user);
  };

  return (
    <Shell title="Staff Sign-in" subtitle="Access listings management and regional controls">
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={field}>
          <label htmlFor="login-id" className="a-label">Staff email, mobile or user code</label>
          <div className="a-input-wrap">
            <Mail size={16} />
            <input
              id="login-id"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoFocus
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setFieldErrors((f) => ({ ...f, identifier: '' })); }}
              onBlur={() => identifier.trim() && setTouched((t) => ({ ...t, id: true }))}
              aria-invalid={!!(touched.id && idError)}
              aria-describedby="login-id-err"
              placeholder="staff@becho.in"
              className="a-input a-input--soft" style={{ height: 44 }}
            />
          </div>
          <FieldError id="login-id-err" msg={touched.id ? idError : null} />
        </div>
        <div style={field}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <label htmlFor="login-pw" className="a-label">Password</label>
            <button type="button" className="a-link" style={{ fontSize: 13, fontWeight: 600 }} onClick={() => onForgot(identifier.trim())}>
              Forgot password?
            </button>
          </div>
          <PasswordInput
            id="login-pw"
            value={password}
            onChange={(v) => { setPassword(v); setFieldErrors((f) => ({ ...f, password: '' })); }}
            onBlur={() => password && setTouched((t) => ({ ...t, pw: true }))}
            autoComplete="current-password"
            invalid={!!(touched.pw && pwError)}
            describedBy="login-pw-err"
          />
          <FieldError id="login-pw-err" msg={touched.pw ? pwError : null} />
        </div>
        <Button type="submit" variant="primary" large block loading={loading} style={{ marginTop: 4 }}>
          {loading ? 'Signing in…' : <>Sign in to Admin Console <ArrowRight size={17} /></>}
        </Button>
      </form>
    </Shell>
  );
};

/* ------------------------------------------------------------------ */

const ForgotPassword: React.FC<{ initialIdentifier: string; onDone: (notice: string | null) => void }> = ({ initialIdentifier, onDone }) => {
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ message: string; otpSentTo?: string; devOtp?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const idError = validateIdentifier(identifier);
  const codeError = /^\d{4,8}$/.test(code.trim()) ? null : 'Enter the code from the email.';
  const pwError = validateNewPassword(pw);
  const confirmError = confirm ? (confirm === pw ? null : 'Passwords don’t match.') : 'Re-enter the new password.';

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched((t) => ({ ...t, id: true }));
    if (idError) return;
    setLoading(true);
    setError(null);
    const res = await fetchApi<{ message: string; otpSentTo?: string; devOtp?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.code === 'OTP_COOLDOWN' ? (res.error.message || 'Please wait a minute before asking for another code.') : res.error?.details?.[0]?.message || res.error?.message || 'Could not send a reset code.');
      return;
    }
    setInfo(res.data);
    setStep('reset');
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((t) => ({ ...t, code: true, pw: true, confirm: true }));
    if (codeError || pwError || confirmError) return;
    setLoading(true);
    setError(null);
    const res = await fetchApi('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier: identifier.trim(), code: code.trim(), newPassword: pw }),
    });
    setLoading(false);
    if (!res.success) {
      setError(
        res.error?.code === 'INVALID_RESET_CODE'
          ? 'That code is wrong or has expired. Check the email or request a new code.'
          : res.error?.details?.[0]?.message || res.error?.message || 'Could not reset the password.',
      );
      return;
    }
    onDone('Password updated. Sign in with your new password.');
  };

  const back = (
    <button type="button" className="a-link" onClick={() => onDone(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, marginTop: 18 }}>
      <ArrowLeft size={14} /> Back to sign in
    </button>
  );

  if (step === 'request') {
    return (
      <Shell title="Reset password" subtitle="We’ll email a one-time code to your staff account">
        {error && <Alert tone="danger">{error}</Alert>}
        <p style={{ fontSize: 13.5, color: 'var(--a-text-2)', marginBottom: 18 }}>
          Enter the email, mobile number or user code of your staff account. We’ll email you a code to set a new password.
        </p>
        <form onSubmit={requestCode} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={field}>
            <label htmlFor="fp-id" className="a-label">Email, mobile or user code</label>
            <div className="a-input-wrap">
              <Mail size={16} />
              <input
                id="fp-id"
                type="text"
                autoComplete="username"
                autoFocus
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, id: true }))}
                aria-invalid={!!(touched.id && idError)}
                aria-describedby="fp-id-err"
                className="a-input a-input--soft" style={{ height: 44 }}
              />
            </div>
            <FieldError id="fp-id-err" msg={touched.id ? idError : null} />
          </div>
          <Button type="submit" variant="primary" large block loading={loading}>
            {loading ? 'Sending…' : 'Send reset code'}
          </Button>
        </form>
        {back}
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password" subtitle="Enter the code we sent and choose a new password">
      {error && <Alert tone="danger">{error}</Alert>}
      {info && (
        <Alert tone="info">
          {info.message}
          {info.otpSentTo && <> Code sent to <strong>{info.otpSentTo}</strong>.</>}
          {info.devOtp && (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <KeyRound size={14} /> Staging code: <strong style={{ fontFamily: 'var(--a-mono)', letterSpacing: '0.1em' }}>{info.devOtp}</strong>
            </div>
          )}
        </Alert>
      )}
      <form onSubmit={reset} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={field}>
          <label htmlFor="fp-code" className="a-label">Reset code</label>
          <div className="a-input-wrap">
            <KeyRound size={16} />
            <input
              id="fp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              onBlur={() => setTouched((t) => ({ ...t, code: true }))}
              aria-invalid={!!(touched.code && codeError)}
              aria-describedby="fp-code-err"
              className="a-input a-input--soft a-mono" style={{ height: 44, paddingLeft: 38, letterSpacing: '0.3em', fontSize: 16 }}
            />
          </div>
          <FieldError id="fp-code-err" msg={touched.code ? codeError : null} />
        </div>
        <div style={field}>
          <label htmlFor="fp-pw" className="a-label">New password</label>
          <PasswordInput id="fp-pw" value={pw} onChange={setPw} autoComplete="new-password" onBlur={() => setTouched((t) => ({ ...t, pw: true }))} invalid={!!(touched.pw && pwError)} describedBy="fp-pw-err" />
          {touched.pw && pwError ? (
            <FieldError id="fp-pw-err" msg={pwError} />
          ) : (
            <div id="fp-pw-err" className="a-field-hint">At least 8 characters, with a letter and a number.</div>
          )}
        </div>
        <div style={field}>
          <label htmlFor="fp-confirm" className="a-label">Confirm new password</label>
          <PasswordInput id="fp-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" onBlur={() => setTouched((t) => ({ ...t, confirm: true }))} invalid={!!(touched.confirm && confirmError)} describedBy="fp-confirm-err" />
          <FieldError id="fp-confirm-err" msg={touched.confirm ? confirmError : null} />
        </div>
        <Button type="submit" variant="primary" large block loading={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        {back}
        <Button variant="ghost" small style={{ marginTop: 18 }} disabled={loading} onClick={() => requestCode()}>Resend code</Button>
      </div>
    </Shell>
  );
};

/* ------------------------------------------------------------------ */

export const AdminLogin: React.FC = () => {
  const [mode, setMode] = useState<{ view: 'signin' | 'forgot'; identifier: string; notice: string | null }>({ view: 'signin', identifier: '', notice: null });
  return mode.view === 'signin' ? (
    <SignIn notice={mode.notice} onForgot={(identifier) => setMode({ view: 'forgot', identifier, notice: null })} />
  ) : (
    <ForgotPassword initialIdentifier={mode.identifier} onDone={(notice) => setMode({ view: 'signin', identifier: '', notice })} />
  );
};
