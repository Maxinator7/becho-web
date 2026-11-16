import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Circle, Eye, EyeOff, Info, AlertTriangle } from 'lucide-react';
import { PASSWORD_RULES } from '../utils/validation';

/* Shared building blocks for the account forms (login, register, reset, account settings). */

export const inputStyle = (invalid?: boolean): React.CSSProperties => ({
  width: '100%',
  minHeight: '44px',
  padding: '0.65rem 0.8rem',
  borderRadius: '10px',
  background: 'var(--input-bg)',
  border: `1px solid ${invalid ? 'var(--danger)' : 'var(--input-border)'}`,
  color: 'var(--input-text)',
  fontSize: '0.95rem',
  outline: 'none',
});

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.85rem',
  color: 'var(--text-primary)',
  marginBottom: '0.4rem',
  fontWeight: 600,
};

export const linkStyle: React.CSSProperties = { color: 'var(--primary-text)', fontWeight: 600 };

type Tone = 'danger' | 'success' | 'warning' | 'info';
const TONE: Record<Tone, { color: string; Icon: typeof Info }> = {
  danger: { color: 'var(--danger)', Icon: AlertCircle },
  success: { color: 'var(--success)', Icon: CheckCircle2 },
  warning: { color: 'var(--warning)', Icon: AlertTriangle },
  info: { color: 'var(--accent-primary)', Icon: Info },
};

/** A message box. Danger alerts are announced to screen readers immediately. */
export const Alert: React.FC<{ tone?: Tone; children: React.ReactNode; style?: React.CSSProperties }> = ({ tone = 'danger', children, style }) => {
  const { color, Icon } = TONE[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        padding: '0.7rem 0.85rem', borderRadius: '10px', fontSize: '0.9rem', lineHeight: 1.45, ...style,
      }}
    >
      <Icon size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
};

export const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? (
    <div id={id} style={{ display: 'flex', gap: '0.3rem', alignItems: 'flex-start', color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{message}</span>
    </div>
  ) : null;

/** aria props wiring an input to its error and optional hint. */
export function describedBy(id: string, error?: string, hint?: boolean) {
  const ids = [error ? `${id}-error` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ');
  return { 'aria-invalid': error ? true : undefined, 'aria-describedby': ids || undefined } as const;
}

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'prefix'> {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  /** Fixed text shown inside the input on the left, e.g. "+91". */
  prefix?: React.ReactNode;
  /** Decorative icon inside the input on the left. */
  icon?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}

export const TextField: React.FC<FieldProps> = ({ id, label, error, hint, prefix, icon, style, inputRef, ...rest }) => (
  <div>
    <label htmlFor={id} style={labelStyle}>{label}</label>
    {icon && !prefix ? (
      <div className="field-icon">
        <span className="fi-icon" aria-hidden="true">{icon}</span>
        <input ref={inputRef} id={id} {...describedBy(id, error, !!hint)} {...rest} style={{ ...inputStyle(!!error), paddingLeft: '2.6rem', ...style }} />
      </div>
    ) : prefix ? (
      <div className="price-input" style={{ borderRadius: '10px', borderColor: error ? 'var(--danger)' : undefined }}>
        <span aria-hidden="true" className="cur" style={{ fontSize: '0.95rem', fontWeight: 600, padding: '0 0.75rem' }}>
          {prefix}
        </span>
        <input ref={inputRef} id={id} {...describedBy(id, error, !!hint)} {...rest} style={{ ...inputStyle(false), border: 'none', borderRadius: 0, background: 'transparent', boxShadow: 'none', ...style }} />
      </div>
    ) : (
      <input ref={inputRef} id={id} {...describedBy(id, error, !!hint)} {...rest} style={{ ...inputStyle(!!error), ...style }} />
    )}
    {hint && !error && <div id={`${id}-hint`} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{hint}</div>}
    <FieldError id={`${id}-error`} message={error} />
  </div>
);

interface PasswordFieldProps extends Omit<FieldProps, 'type' | 'prefix'> {
  /** Show a green tick in the field (e.g. confirmation matches). */
  success?: boolean;
  /** Extra content under the input (e.g. the rules checklist). */
  children?: React.ReactNode;
  labelAside?: React.ReactNode;
}

/** Password input with a show/hide toggle and a Caps Lock warning. */
export const PasswordField: React.FC<PasswordFieldProps> = ({ id, label, error, hint, children, labelAside, onKeyUp, onKeyDown, onBlur, inputRef, icon, success, ...rest }) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'));
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
        <label htmlFor={id} style={labelStyle}>{label}</label>
        {labelAside}
      </div>
      <div style={{ position: 'relative' }} className={icon ? 'field-icon' : undefined}>
        {icon && <span className="fi-icon" aria-hidden="true">{icon}</span>}
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          {...describedBy(id, error, !!hint || capsLock)}
          {...rest}
          onKeyUp={(e) => { checkCaps(e); onKeyUp?.(e); }}
          onKeyDown={(e) => { checkCaps(e); onKeyDown?.(e); }}
          onBlur={(e) => { setCapsLock(false); onBlur?.(e); }}
          style={{ ...inputStyle(!!error), paddingRight: success ? '4.6rem' : '2.75rem', ...(icon ? { paddingLeft: '2.6rem' } : {}) }}
        />
        {success && <CheckCircle2 size={19} className="fi-ok" aria-label="Passwords match" />}
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', borderRadius: '6px' }}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {(capsLock || hint) && (
        <div id={`${id}-hint`} style={{ fontSize: '0.78rem', marginTop: '0.3rem', color: capsLock ? 'var(--warning)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          {capsLock ? <><AlertTriangle size={13} /> Caps Lock is on</> : hint}
        </div>
      )}
      <FieldError id={`${id}-error`} message={error} />
      {children}
    </div>
  );
};

/** Live list of password rules, ticked as they're met. */
export const PasswordChecklist: React.FC<{ password: string; id?: string }> = ({ password, id }) => (
  <ul id={id} aria-label="Password requirements" style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '0.25rem 1rem', marginTop: '0.45rem', fontSize: '0.78rem' }}>
    {PASSWORD_RULES.map((r) => {
      const ok = r.test(password);
      return (
        <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: ok ? 'var(--success)' : 'var(--text-muted)' }}>
          {ok ? <CheckCircle2 size={13} /> : <Circle size={13} />} {r.label}
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{ok ? '(met)' : '(not met)'}</span>
        </li>
      );
    })}
  </ul>
);

/** Sign-in / sign-up / reset layout: heading above, the form in a card, extra cards below. */
export const AuthCard: React.FC<{
  title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; maxWidth?: number;
  icon?: React.ReactNode; overline?: string; top?: React.ReactNode; after?: React.ReactNode;
}> = ({ title, subtitle, children, footer, maxWidth = 440, icon, overline, top, after }) => (
  <main className="auth-wrap" style={{ maxWidth: `${maxWidth}px` }}>
    <div className="auth-brand">
      <Link to="/" className="brand" aria-label="Becho home">
        <span className="brand-mark" aria-hidden="true">B</span>
        <span className="brand-text">
          <span className="brand-name">Becho</span>
          <span className="brand-tag">Buy & Sell Locally</span>
        </span>
      </Link>
    </div>
    {top}
    <header className="auth-head">
      {icon && <div className="auth-icon" aria-hidden="true">{icon}</div>}
      {overline && <div className="auth-pill"><span className="dot" aria-hidden="true" /> {overline}</div>}
      <h1 className="page-title auth-title">{title}</h1>
      {subtitle && <p className="auth-sub">{subtitle}</p>}
    </header>
    <div className="card auth-card">{children}</div>
    {footer && <div className="auth-foot">{footer}</div>}
    {after}
  </main>
);

/** Two-or-more step indicator ("Identity → Reset"). */
export const Stepper: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <ol className="stepper" aria-label={`Step ${current + 1} of ${steps.length}`}>
    {steps.map((label, i) => (
      <li key={label} className={i < current ? 'done' : i === current ? 'on' : ''} aria-current={i === current ? 'step' : undefined}>
        <span className="st-dot">{i < current ? <CheckCircle2 size={14} /> : i + 1}</span>
        <span className="st-label">{label}</span>
      </li>
    ))}
  </ol>
);

/** Password strength bar: rules met, plus length and character variety. */
export function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!p) return { score: 0, label: '' };
  const rules = PASSWORD_RULES.filter((r) => r.test(p)).length;
  if (rules < PASSWORD_RULES.length) return { score: 1, label: 'Too weak' };
  let score = 2;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  const s = Math.min(4, score) as 2 | 3 | 4;
  return { score: s, label: s === 2 ? 'Fair' : s === 3 ? 'Good' : 'Strong' };
}

export const PasswordStrength: React.FC<{ password: string; children?: React.ReactNode }> = ({ password, children }) => {
  const { score, label } = passwordStrength(password);
  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-head">
        <span className="pw-title">Security strength</span>
        {password && <span className={`pw-tag s${score}`}>{label}</span>}
      </div>
      <div className={`pw-bars s${score}`} aria-hidden="true"><span /><span /><span /><span /></div>
      {children}
      {!password && <span className="pw-label">Tip: 12+ characters with upper and lower case, numbers and a symbol is strongest.</span>}
    </div>
  );
};

/** Small dev/staging banner with the code (only when the API exposes it). */
export const DevOtpNotice: React.FC<{ code?: string }> = ({ code }) =>
  code ? (
    <Alert tone="info" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
      Test mode: your code is <strong style={{ letterSpacing: '2px' }}>{code}</strong>
    </Alert>
  ) : null;

/** Seconds left on a resend cooldown; call `start()` after sending a code. */
export function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return { left, start: (seconds = 60) => setLeft(seconds) };
}

/**
 * 6-digit code input. A single field (not six boxes) so paste, autofill from SMS/email
 * ("one-time-code") and screen readers all work; non-digits are stripped on input.
 */
export const OtpField: React.FC<{
  id: string;
  label: string;
  value: string;
  onChange: (code: string) => void;
  error?: string;
  autoFocus?: boolean;
  onComplete?: (code: string) => void;
}> = ({ id, label, value, onChange, error, autoFocus, onComplete }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {/* One real input (paste, autofill, screen readers) drawn as six boxes. */}
      <div className={`otp-boxes${error ? ' invalid' : ''}${focused ? ' focused' : ''}`}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`otp-box${value[i] ? ' filled' : ''}${focused && i === Math.min(value.length, 5) ? ' caret' : ''}`} aria-hidden="true">{value[i] ?? ''}</span>
        ))}
        <input
          id={id}
          className="otp-input"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus={autoFocus}
          value={value}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...describedBy(id, error)}
          onChange={(e) => {
            const code = e.target.value.replace(/\D/g, '').slice(0, 6);
            onChange(code);
            if (code.length === 6) onComplete?.(code);
          }}
          onPaste={(e) => {
            // Accept "123 456" or "Your code is 123456" pasted from an email.
            const digits = e.clipboardData.getData('text').replace(/\D/g, '');
            if (digits.length >= 6) {
              e.preventDefault();
              const code = digits.slice(0, 6);
              onChange(code);
              onComplete?.(code);
            }
          }}
        />
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
};
