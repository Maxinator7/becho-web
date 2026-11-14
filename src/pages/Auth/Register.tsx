import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi, AuthTokens } from '../../api/client';
import { useAuth, UserProfile } from '../../context/AuthContext';
import { UserPlus, AlertCircle } from 'lucide-react';

export const Register: React.FC = () => {
  const [displayName, setDisplayName] = useState('');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const isEmail = emailOrPhone.includes('@');
    const body = {
      displayName,
      email: isEmail ? emailOrPhone.trim() : undefined,
      phone: !isEmail ? emailOrPhone.trim() : undefined,
      password,
    };

    const res = await fetchApi<{ tokens: AuthTokens; user: UserProfile; verificationMessage: string; devOtp?: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setLoading(false);
    if (res.success && res.data) {
      login(res.data.tokens, res.data.user);
      navigate('/verify', { state: { otp: { verificationMessage: res.data.verificationMessage, devOtp: res.data.devOtp } } });
    } else {
      setError(res.error?.message || 'Registration failed.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', padding: '0 1rem' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.75rem' }}>
          Join <span className="gradient-text">BECHO</span> Marketplace
        </h2>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Full Name / Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Mobile number or email
              </label>
              <input
                type="text"
                required
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="98765 43210 or you@example.com"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--input-text)' }}
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <UserPlus size={18} />
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1.5rem', fontSize: '0.9rem' }}>
          Already registered? <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Sign In</Link>
        </p>
      </div>
    </div>
  );
};
