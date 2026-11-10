import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface Props {
  children: React.ReactElement;
  /** Also require a verified (ACTIVE) account. */
  verified?: boolean;
  /** Require ADMIN or MODERATOR. */
  staff?: boolean;
}

export const RequireAuth: React.FC<Props> = ({ children, verified, staff }) => {
  const { user, isLoading, isVerified, isStaff } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (verified && !isVerified) return <Navigate to="/verify" replace state={{ from: location.pathname + location.search }} />;
  if (staff && !isStaff) return <Navigate to="/" replace />;
  return children;
};
