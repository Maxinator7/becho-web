import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation as useRouterLocation } from 'react-router-dom';
import { fetchApi, AuthTokens } from '../../api/client';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { ArrowRight, Clock, HelpCircle, Mail, ShieldCheck } from 'lucide-react';
import { Alert, AuthCard, DevOtpNotice, OtpField, useCountdown } from '../../components/FormControls';
import { validateOtp } from '../../utils/validation';
import { OtpInfo, clearOtpInfo, cooldownLeft, loadOtpInfo, saveOtpInfo } from './otpInfo';

export const VerifyAccount: React.FC = () => {
  const { user, isVerified, login } = useAuth();
  const navigate = useNavigate();
  const state = (useRouterLocation().state || {}) as { from?: string; otp?: OtpInfo };
  const redirectTo = state.from || '/';

  const [info, setInfo] = useState<OtpInfo | null>(() => state.otp ?? loadOtpInfo());
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const cooldown = useCountdown(cooldownLeft(info?.sentAt));

  useEffect(() => {
    if (isVerified) {
      clearOtpInfo();
      navigate(redirectTo, { replace: true });
    }
  }, [isVerified, navigate, redirectTo]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    const msg = validateOtp(code);
    setCodeError(msg);
    if (msg) {
      document.getElementById('verify-code')?.focus();
      return;
    }
    setLoading(true);
    const res = await fetchApi<{ user: UserProfile; tokens: AuthTokens }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setLoading(false);
    if (res.success && res.data) {
      // New tokens carry the ACTIVE status; the effect above redirects.
      login(res.data.tokens, res.data.user);
    } else {
      setCodeError(res.error?.message || 'That code is not valid. Check it and try again.');
      document.getElementById('verify-code')?.focus();
    }
  };

  const handleResend = async () => {
    if (sending || cooldown.left > 0) return;
    setError(null);
    setNotice(null);
    setSending(true);
    const res = await fetchApi<OtpInfo>('/auth/resend-otp', { method: 'POST' });
    setSending(false);
    if (res.success && res.data) {
      const next = { ...res.data, sentAt: Date.now() };
      setInfo(next);
      saveOtpInfo(next);
      setCode('');
      setNotice('We sent you a new code. Codes from earlier emails no longer work.');
      cooldown.start(60);
    } else if (res.error?.code === 'OTP_COOLDOWN') {
      setError('Please wait a minute before asking for another code.');
      cooldown.start(60);
    } else {
      setError(res.error?.message || 'Could not send a new code. Please try again.');
    }
  };

  const destination = info?.otpSentTo || user?.email || 'your email';

  return (
    <AuthCard
      icon={<span className="otp-icon"><Mail size={26} /><span className="otp-badge"><ShieldCheck size={13} /></span></span>}
      title="Verify your email address"
      subtitle={<>We have sent a 6-digit verification code to <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{destination}</strong></>}
      after={
        <div className="auth-info">
          <span className="ai-icon"><HelpCircle size={18} /></span>
          <div>
            <div className="ai-title">Didn’t receive the email?</div>
            <div className="ai-text">Check your spam or junk folder, and make sure your mailbox isn’t full. The code expires in 15 minutes.</div>
            {cooldown.left <= 0 && <button type="button" className="link" style={{ fontSize: '0.84rem', marginTop: 4 }} onClick={handleResend} disabled={sending}>{sending ? 'Sending…' : 'Resend the code'}</button>}
          </div>
        </div>
      }
    >
      <DevOtpNotice code={info?.devOtp} />
      {notice && <Alert tone="success" style={{ marginBottom: '1rem' }}>{notice}</Alert>}
      {error && <Alert style={{ marginBottom: '1rem' }}>{error}</Alert>}

      <form onSubmit={handleVerify} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <OtpField
          id="verify-code" label="Verification code" value={code} autoFocus error={codeError}
          onChange={(c) => { setCode(c); if (codeError) setCodeError(undefined); }}
        />
        <div className="resend-row">
          {cooldown.left > 0 ? (
            <span aria-live="polite" className="resend-pill"><Clock size={14} /> Resend code in <strong>{Math.floor(cooldown.left / 60)}:{String(cooldown.left % 60).padStart(2, '0')}</strong></span>
          ) : (
            <button type="button" onClick={handleResend} disabled={sending} className="link">{sending ? 'Sending…' : 'Resend code'}</button>
          )}
        </div>
        <button type="submit" disabled={loading} aria-busy={loading} className="btn-primary btn-cta" style={{ width: '100%', minHeight: '52px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Verifying…' : <>Verify &amp; continue <ArrowRight size={19} /></>}
        </button>
      </form>

    </AuthCard>
  );
};
