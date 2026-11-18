import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi, AuthTokens } from '../../api/client';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { ArrowRight, Lock, Mail, RotateCcw, User } from 'lucide-react';
import { Alert, AuthCard, PasswordChecklist, PasswordField, PasswordStrength, TextField, linkStyle } from '../../components/FormControls';
import {
  FieldErrors, fieldErrorsFrom, focusFirstError, hasErrors, normalizeIndianMobile,
  validateConfirm, validateEmail, validateMobile, validateName, validatePassword,
} from '../../utils/validation';
import { OtpInfo, saveOtpInfo } from './otpInfo';

type Field = 'name' | 'mobile' | 'email' | 'password' | 'confirm';
const FIELDS: Field[] = ['name', 'mobile', 'email', 'password', 'confirm'];
type Values = Record<Field, string>;

const validators: Record<Field, (v: Values) => string | undefined> = {
  name: (v) => validateName(v.name),
  mobile: (v) => validateMobile(v.mobile),
  email: (v) => validateEmail(v.email),
  password: (v) => validatePassword(v.password),
  confirm: (v) => validateConfirm(v.password, v.confirm),
};

export const Register: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState<Values>({ name: '', mobile: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState<string | undefined>();

  const set = (field: Field, value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    const recheck: Field[] = field === 'password' ? ['password', 'confirm'] : [field];
    setErrors((e) => {
      const out = { ...e };
      for (const f of recheck) if (touched[f]) out[f] = validators[f](next);
      return out;
    });
  };

  const blur = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validators[field](values) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError(null);
    const trimmed = { ...values, name: values.name.trim().replace(/\s+/g, ' '), email: values.email.trim(), mobile: values.mobile.trim() };
    setValues(trimmed);
    const next: FieldErrors<Field> = {};
    for (const f of FIELDS) next[f] = validators[f](trimmed);
    setErrors(next);
    setTouched({ name: true, mobile: true, email: true, password: true, confirm: true });
    const termsErr = agreed ? undefined : 'Please agree to the beta terms and privacy notice to continue';
    setAgreeError(termsErr);
    if (!hasErrors(next) && termsErr) { document.getElementById('reg-terms')?.focus(); return; }
    if (hasErrors(next)) {
      focusFirstError(next, FIELDS, 'reg-');
      return;
    }

    setLoading(true);
    const res = await fetchApi<{ tokens: AuthTokens; user: UserProfile } & OtpInfo>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        displayName: trimmed.name,
        phone: `+91${normalizeIndianMobile(trimmed.mobile)}`,
        email: trimmed.email,
        password: trimmed.password,
      }),
    });
    setLoading(false);

    if (res.success && res.data) {
      const otp: OtpInfo = {
        otpSentTo: res.data.otpSentTo,
        verificationMessage: res.data.verificationMessage,
        devOtp: res.data.devOtp,
        sentAt: Date.now(),
      };
      saveOtpInfo(otp);
      login(res.data.tokens, res.data.user);
      navigate('/verify', { state: { otp } });
      return;
    }

    const code = res.error?.code ?? 'UNKNOWN';
    if (code === 'PHONE_TAKEN' || code === 'EMAIL_TAKEN') {
      const field: Field = code === 'PHONE_TAKEN' ? 'mobile' : 'email';
      const msg = code === 'PHONE_TAKEN' ? 'This mobile number is already registered.' : 'This email is already registered.';
      setErrors((e2) => ({ ...e2, [field]: msg }));
      setFormError({ code, message: msg });
      focusFirstError({ [field]: msg }, FIELDS, 'reg-');
      return;
    }
    const fieldErrs = fieldErrorsFrom(res, FIELDS, { displayName: 'name', phone: 'mobile' });
    if (hasErrors(fieldErrs)) {
      setErrors(fieldErrs);
      focusFirstError(fieldErrs, FIELDS, 'reg-');
      return;
    }
    setFormError({ code, message: res.error?.message || 'Registration failed. Please try again.' });
  };

  const existingIdentifier = formError?.code === 'PHONE_TAKEN' ? values.mobile.trim() : values.email.trim();

  return (
    <AuthCard
      maxWidth={460}
      overline="Your neighbourhood marketplace"
      title="Create your Becho account"
      subtitle="Buy and sell pre-loved goods with people in your city."
      footer={<>Already registered? <Link to="/login" style={linkStyle}>Sign in</Link></>}
    >
      {formError && (
        <Alert tone={formError.code === 'NETWORK_ERROR' ? 'warning' : 'danger'} style={{ marginBottom: '1rem' }}>
          {formError.message}
          {(formError.code === 'PHONE_TAKEN' || formError.code === 'EMAIL_TAKEN') && (
            <div style={{ marginTop: '0.35rem' }}>
              <Link to="/login" state={{ identifier: existingIdentifier }} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>Sign in</Link>
              {' '}or{' '}
              <Link to="/forgot-password" state={{ identifier: existingIdentifier }} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'underline' }}>reset your password</Link>.
            </div>
          )}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <TextField
          id="reg-name" label="Full name" name="name" autoComplete="name" required maxLength={60}
          value={values.name} onChange={(e) => set('name', e.target.value)} onBlur={() => blur('name')}
          placeholder="e.g. Priya Sharma" error={errors.name} icon={<User size={18} />}
        />
        <TextField
          id="reg-mobile" label="Mobile number" name="tel" type="tel" inputMode="numeric" autoComplete="tel-national" required
          prefix={<><span className="flag" aria-hidden="true">🇮🇳</span> +91</>} maxLength={16}
          value={values.mobile} onChange={(e) => set('mobile', e.target.value.replace(/[^\d\s+-]/g, ''))} onBlur={() => blur('mobile')}
          placeholder="98765 43210" error={errors.mobile}
          hint="We’ll use this to keep your account secure. It isn’t shown to buyers."
        />
        <TextField
          id="reg-email" label="Email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required
          value={values.email} onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')}
          placeholder="you@example.com" error={errors.email} icon={<Mail size={18} />}
          hint="We’ll email you a 6-digit code to verify your account."
        />
        <PasswordField
          id="reg-password" label="Password" name="new-password" autoComplete="new-password" required maxLength={128}
          value={values.password} onChange={(e) => set('password', e.target.value)} onBlur={() => blur('password')}
          error={errors.password} icon={<Lock size={18} />}
        >
          <PasswordStrength password={values.password}>
            <PasswordChecklist password={values.password} />
          </PasswordStrength>
        </PasswordField>
        <PasswordField
          id="reg-confirm" label="Confirm password" name="confirm-password" autoComplete="new-password" required maxLength={128}
          value={values.confirm} onChange={(e) => set('confirm', e.target.value)} onBlur={() => blur('confirm')}
          error={errors.confirm} icon={<RotateCcw size={18} />}
          success={!!values.confirm && values.confirm === values.password && !validatePassword(values.password)}
        />

        <div>
          <label className="terms-check" htmlFor="reg-terms">
            <input
              id="reg-terms" type="checkbox" checked={agreed}
              aria-invalid={!!agreeError} aria-describedby={agreeError ? 'reg-terms-error' : undefined}
              onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setAgreeError(undefined); }}
            />
            <span>
              I agree to the{' '}
              <a href="/privacy" target="_blank" rel="noopener" className="link" onClick={(e) => e.stopPropagation()}>
                Becho beta terms and privacy notice
              </a>
            </span>
          </label>
          {agreeError && <div id="reg-terms-error" role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.3rem' }}>{agreeError}</div>}
        </div>

        <button
          type="submit" disabled={loading} aria-busy={loading} className="btn-primary btn-cta"
          style={{ width: '100%', minHeight: '52px', marginTop: '0.25rem', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Creating account…' : <>Create account &amp; verify <ArrowRight size={19} /></>}
        </button>
      </form>
    </AuthCard>
  );
};
