import React, { useState } from 'react';
import { Link, useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, KeyRound, ArrowLeft, ArrowRight, AtSign, Lock, LogOut, RotateCcw } from 'lucide-react';
import {
  Alert, AuthCard, DevOtpNotice, OtpField, PasswordChecklist, PasswordField, PasswordStrength, Stepper, TextField, linkStyle, useCountdown,
} from '../../components/FormControls';
import {
  FieldErrors, fieldErrorsFrom, focusFirstError, hasErrors, validateConfirm, validateIdentifier, validateOtp, validatePassword,
} from '../../utils/validation';

type Step = 'request' | 'reset' | 'done';
type ResetField = 'code' | 'password' | 'confirm';
const RESET_FIELDS: ResetField[] = ['code', 'password', 'confirm'];

const GENERIC_SENT = 'If an account matches what you entered, we’ve emailed it a 6-digit code. Enter it below with your new password.';

interface ForgotResponse { message: string; otpSentTo?: string; devOtp?: string }

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const initial = ((useRouterLocation().state || {}) as { identifier?: string }).identifier ?? '';

  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState(initial);
  const [identifierError, setIdentifierError] = useState<string | undefined>();
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const cooldown = useCountdown();

  const [values, setValues] = useState<Record<ResetField, string>>({ code: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors<ResetField>>({});
  const [touched, setTouched] = useState<Partial<Record<ResetField, boolean>>>({});

  const validators: Record<ResetField, (v: Record<ResetField, string>) => string | undefined> = {
    code: (v) => validateOtp(v.code),
    password: (v) => validatePassword(v.password),
    confirm: (v) => validateConfirm(v.password, v.confirm),
  };

  /** Sends (or re-sends) the reset code. Returns true when the user can go on to enter it. */
  const requestCode = async (id: string): Promise<boolean> => {
    setFormError(null);
    setNotice(null);
    setLoading(true);
    const res = await fetchApi<ForgotResponse>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ identifier: id }) });
    setLoading(false);
    if (res.success && res.data) {
      // Deliberately ignore otpSentTo: showing it would confirm the account exists.
      setDevOtp(res.data.devOtp);
      setNotice(GENERIC_SENT);
      cooldown.start(60);
      return true;
    }
    if (res.error?.code === 'OTP_COOLDOWN') {
      setNotice('A code was sent a moment ago — check your email. You can ask for another one in a minute.');
      cooldown.start(60);
      return true;
    }
    if (res.error?.code === 'VALIDATION_ERROR') {
      setIdentifierError(fieldErrorsFrom(res, ['identifier'] as const).identifier ?? res.error.message);
      setStep('request');
      return false;
    }
    setFormError(res.error?.message || 'Could not send a code. Please try again.');
    return false;
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const id = identifier.trim();
    setIdentifier(id);
    const err = validateIdentifier(id);
    setIdentifierError(err);
    if (err) {
      document.getElementById('fp-identifier')?.focus();
      return;
    }
    if (await requestCode(id)) setStep('reset');
  };

  const setField = (field: ResetField, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    const recheck: ResetField[] = field === 'password' ? ['password', 'confirm'] : [field];
    setErrors((e) => {
      const out = { ...e };
      for (const f of recheck) if (touched[f] && f !== 'code') out[f] = validators[f](next);
      return out;
    });
  };
  const blurField = (field: ResetField) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validators[field](values) }));
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError(null);
    const next: FieldErrors<ResetField> = {};
    for (const f of RESET_FIELDS) next[f] = validators[f](values);
    setErrors(next);
    setTouched({ code: true, password: true, confirm: true });
    if (hasErrors(next)) {
      focusFirstError(next, RESET_FIELDS, 'fp-');
      return;
    }
    setLoading(true);
    const res = await fetchApi<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ identifier, code: values.code, newPassword: values.password }),
    });
    setLoading(false);
    if (res.success) {
      // Resetting signs out every session, including this browser's.
      if (user) logout();
      setStep('done');
      return;
    }
    if (res.error?.code === 'INVALID_RESET_CODE') {
      setErrors({ code: res.error.message || 'That code is wrong or has expired. Request a new one.' });
      focusFirstError({ code: 'x' }, RESET_FIELDS, 'fp-');
      return;
    }
    const fieldErrs = fieldErrorsFrom(res, RESET_FIELDS, { newPassword: 'password' });
    if (hasErrors(fieldErrs)) {
      setErrors(fieldErrs);
      focusFirstError(fieldErrs, RESET_FIELDS, 'fp-');
      return;
    }
    setFormError(res.error?.message || 'Could not reset your password. Please try again.');
  };

  if (step === 'done') {
    return (
      <AuthCard icon={<CheckCircle2 size={24} color="var(--success)" />} title="Password updated">
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          You can now sign in with your new password. For your security, you’ve been signed out on all devices.
        </p>
        <button
          type="button" className="btn-primary" style={{ width: '100%', minHeight: '48px' }}
          onClick={() => navigate('/login', { replace: true, state: { identifier, notice: 'Password updated. Sign in with your new password.' } })}
        >
          Sign in
        </button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      top={<Stepper steps={['Identity', 'Reset']} current={step === 'request' ? 0 : 1} />}
      icon={step === 'request' ? <KeyRound size={24} /> : undefined}
      title={step === 'request' ? 'Reset your password' : 'Set a new password'}
      subtitle={step === 'request'
        ? 'Enter the email, mobile number or user code on your account. We’ll email you a code to set a new password.'
        : undefined}
      footer={<>Remembered it? <Link to="/login" state={{ identifier }} style={linkStyle}>Back to sign in</Link></>}
    >
      {formError && <Alert tone="danger" style={{ marginBottom: '1rem' }}>{formError}</Alert>}

      {step === 'request' ? (
        <form onSubmit={handleRequest} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <TextField
            id="fp-identifier" label="Email, mobile number or user code" name="username" autoComplete="username"
            autoCapitalize="none" spellCheck={false} autoFocus required
            value={identifier}
            onChange={(e) => { setIdentifier(e.target.value); if (identifierError) setIdentifierError(validateIdentifier(e.target.value)); }}
            onBlur={() => setIdentifierError(validateIdentifier(identifier))}
            placeholder="you@example.com, 98765 43210 or BCH-XXXXXX"
            error={identifierError} icon={<AtSign size={18} />}
          />
          <button type="submit" disabled={loading} aria-busy={loading} className="btn-primary btn-cta" style={{ width: '100%', minHeight: '52px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Sending code…' : <>Send code <ArrowRight size={19} /></>}
          </button>
        </form>
      ) : (
        <>
          {notice && <Alert tone="info" style={{ marginBottom: '1rem' }}>{notice}</Alert>}
          <DevOtpNotice code={devOtp} />
          <form onSubmit={handleReset} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <input type="text" name="username" autoComplete="username" value={identifier} readOnly hidden />
            <OtpField
              id="fp-code" label="6-digit code" value={values.code} autoFocus error={errors.code}
              onChange={(c) => { setField('code', c); if (errors.code) setErrors((e2) => ({ ...e2, code: undefined })); }}
            />
            <PasswordField
              id="fp-password" label="New password" name="new-password" autoComplete="new-password" required maxLength={128}
              value={values.password} onChange={(e) => setField('password', e.target.value)} onBlur={() => blurField('password')}
              error={errors.password} icon={<Lock size={18} />}
            >
              <PasswordStrength password={values.password}>
                <PasswordChecklist password={values.password} />
              </PasswordStrength>
            </PasswordField>
            <PasswordField
              id="fp-confirm" label="Confirm new password" name="confirm-password" autoComplete="new-password" required maxLength={128}
              value={values.confirm} onChange={(e) => setField('confirm', e.target.value)} onBlur={() => blurField('confirm')}
              error={errors.confirm} icon={<RotateCcw size={18} />}
              success={!!values.confirm && values.confirm === values.password && !validatePassword(values.password)}
            />
            <div className="info-line"><LogOut size={15} /> For your security, resetting your password signs you out on all devices.</div>
            <button type="submit" disabled={loading} aria-busy={loading} className="btn-primary btn-cta" style={{ width: '100%', minHeight: '52px', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Updating…' : <>Set new password <ArrowRight size={19} /></>}
            </button>
          </form>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <button
              type="button"
              onClick={() => { setStep('request'); setNotice(null); setDevOtp(undefined); setValues({ code: '', password: '', confirm: '' }); setErrors({}); setTouched({}); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-secondary)', padding: 0 }}
            >
              <ArrowLeft size={14} /> Use a different account
            </button>
            {cooldown.left > 0 ? (
              <span aria-live="polite">Resend code in {cooldown.left}s</span>
            ) : (
              <button type="button" disabled={loading} onClick={() => void requestCode(identifier)} style={{ ...linkStyle, padding: 0 }}>
                Resend code
              </button>
            )}
          </div>
        </>
      )}
    </AuthCard>
  );
};
