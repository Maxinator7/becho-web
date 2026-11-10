import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi, AuthTokens } from '../../api/client';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface OtpInfo { verificationMessage: string; devOtp?: string }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', textAlign: 'center', fontSize: '1.25rem', letterSpacing: '4px',
};

export const VerifyAccount: React.FC = () => {
  const { user, isVerified, login } = useAuth();
  const navigate = useNavigate();
  const routerLocation = useRouterLocation();
  const state = (routerLocation.state || {}) as { from?: string; otp?: OtpInfo };
  const redirectTo = state.from || '/';

  const [code, setCode] = useState('');
  const [info, setInfo] = useState<OtpInfo | null>(state.otp ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVerified) navigate(redirectTo, { replace: true });
  }, [isVerified, navigate, redirectTo]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetchApi<{ user: UserProfile; tokens: AuthTokens }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code: code.trim() }),
    });
    setLoading(false);
    if (res.success && res.data) {
      // New tokens carry the ACTIVE status; the effect above redirects.
      login(res.data.tokens, res.data.user);
    } else {
      setError(res.error?.message || 'Invalid verification code.');
    }
  };

  const handleResend = async () => {
    setError(null);
    const res = await fetchApi<OtpInfo>('/auth/resend-otp', { method: 'POST' });
    if (res.success && res.data) setInfo(res.data);
    else setError(res.error?.message || 'Could not send a new code.');
  };

  const destination = user?.phone || user?.email || 'your phone';

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '0 1rem' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <ShieldCheck size={24} color="var(--accent-primary)" /> Verify your account
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Enter the 6-digit code sent to <strong>{destination}</strong>.
        </p>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} /> <span>{error}</span>
          </div>
        )}
        {info?.devOtp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
            <CheckCircle2 size={18} /> <span>Dev mode: your code is <strong>{info.devOtp}</strong></span>
          </div>
        )}

        <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} pattern="\d{6}"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="••••••" style={inputStyle}
          />
          <button type="submit" disabled={loading || code.length !== 6} className="btn-primary" style={{ width: '100%', padding: '0.75rem' }}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1.25rem', fontSize: '0.9rem' }}>
          Didn't get a code?{' '}
          <button onClick={handleResend} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, cursor: 'pointer' }}>
            Send again
          </button>
        </p>
      </div>
    </div>
  );
};
