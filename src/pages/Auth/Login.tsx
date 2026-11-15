import React, { useRef, useState } from 'react';
import { useNavigate, Link, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi, AuthTokens } from '../../api/client';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { LogIn } from 'lucide-react';
import { Alert, AuthCard, PasswordField, TextField, linkStyle } from '../../components/FormControls';
import { FieldErrors, fieldErrorsFrom, focusFirstError, hasErrors, validateIdentifier } from '../../utils/validation';

type Field = 'identifier' | 'password';
const FIELDS: Field[] = ['identifier', 'password'];

interface FormError { code: string; message: string }

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const state = (useRouterLocation().state || {}) as { from?: string; identifier?: string; notice?: string };
  const from = state.from || '/';

  const [identifier, setIdentifier] = useState(state.identifier ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [formError, setFormError] = useState<FormError | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const validate = (field: Field, values = { identifier, password }) =>
    field === 'identifier' ? validateIdentifier(values.identifier) : values.password ? undefined : 'Enter your password';

  const onBlur = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((e) => ({ ...e, [field]: validate(field) }));
  };

  const onChange = (field: Field, value: string) => {
    if (field === 'identifier') setIdentifier(value);
    else setPassword(value);
    // Once a field has been visited, re-check it as the user types so errors clear promptly.
    if (touched[field]) {
      const next = { identifier, password, [field]: value };
      setErrors((e) => ({ ...e, [field]: validate(field, next) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setFormError(null);
    const trimmed = identifier.trim();
    setIdentifier(trimmed);
    const next: FieldErrors<Field> = {
      identifier: validate('identifier', { identifier: trimmed, password }),
      password: validate('password'),
    };
    setErrors(next);
    setTouched({ identifier: true, password: true });
    if (hasErrors(next)) {
      focusFirstError(next, FIELDS, 'login-');
      return;
    }

    setLoading(true);
    const res = await fetchApi<{ tokens: AuthTokens; user: UserProfile }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: trimmed, password }),
    });
    setLoading(false);

    if (res.success && res.data) {
      login(res.data.tokens, res.data.user);
      navigate(res.data.user.status === 'PENDING_VERIFICATION' ? '/verify' : from, { replace: true, state: { from } });
      return;
    }

    const code = res.error?.code ?? 'UNKNOWN';
    if (code === 'VALIDATION_ERROR') {
      const fieldErrs = fieldErrorsFrom(res, FIELDS, { email: 'identifier', phone: 'identifier' });
      if (hasErrors(fieldErrs)) {
        setErrors(fieldErrs);
        focusFirstError(fieldErrs, FIELDS, 'login-');
        return;
      }
    }
    if (code === 'INVALID_CREDENTIALS') {
      // Keep the identifier, clear the password and put the cursor back there.
      setPassword('');
      setFormError({ code, message: 'Those details don’t match an account. Check your email, mobile number or user code and password.' });
      setTimeout(() => passwordRef.current?.focus(), 0);
      return;
    }
    if (code === 'ACCOUNT_LOCKED') setPassword('');
    setFormError({
      code,
      message: res.error?.message || 'Sign in failed. Please try again.',
    });
  };

  return (
    <AuthCard
      title={<>Welcome back to <span className="gradient-text">BECHO</span></>}
      subtitle="Sign in to buy, sell and chat."
      footer={<>Don't have an account? <Link to="/register" style={linkStyle}>Create one</Link></>}
    >
      {state.notice && !formError && <Alert tone="success" style={{ marginBottom: '1rem' }}>{state.notice}</Alert>}
      {formError && (
        <Alert tone={formError.code === 'NETWORK_ERROR' ? 'warning' : 'danger'} style={{ marginBottom: '1rem' }}>
          {formError.message}
          {formError.code === 'ACCOUNT_LOCKED' && (
            <div style={{ marginTop: '0.35rem' }}>
              <Link to="/forgot-password" state={{ identifier: identifier.trim() }} style={{ ...linkStyle, color: 'inherit', textDecoration: 'underline' }}>
                Reset your password
              </Link>{' '}to get back in now.
            </div>
          )}
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <TextField
          id="login-identifier"
          label="Email, mobile number or user code"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identifier}
          onChange={(e) => onChange('identifier', e.target.value)}
          onBlur={() => onBlur('identifier')}
          placeholder="you@example.com, 98765 43210 or BCH-XXXXXX"
          error={errors.identifier}
          required
        />

        <PasswordField
          id="login-password"
          label="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => onChange('password', e.target.value)}
          onBlur={() => onBlur('password')}
          error={errors.password}
          required
          inputRef={passwordRef}
          labelAside={
            <Link to="/forgot-password" state={{ identifier: identifier.trim() }} style={{ ...linkStyle, fontSize: '0.82rem' }}>
              Forgot password?
            </Link>
          }
        />

        <button
          type="submit"
          disabled={loading}
          aria-busy={loading}
          className="btn-primary"
          style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', opacity: loading ? 0.7 : 1, cursor: loading ? 'wait' : 'pointer' }}
        >
          <LogIn size={18} />
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
};
