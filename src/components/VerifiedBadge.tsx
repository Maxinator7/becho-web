import React from 'react';
import { ShieldCheck } from 'lucide-react';

/** "Verified" chip for listings staff have checked (listing.verifiedAt). */
export const VerifiedBadge: React.FC<{ size?: 'sm' | 'md'; overlay?: boolean; style?: React.CSSProperties }> = ({ size = 'sm', overlay, style }) => (
  <span
    title="Verified by Becho"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap',
      fontSize: size === 'sm' ? '0.72rem' : '0.82rem', fontWeight: 700,
      padding: size === 'sm' ? '2px 8px' : '0.25rem 0.75rem', borderRadius: '999px',
      // On photos use a solid chip so it reads on any image; elsewhere a soft tint.
      ...(overlay
        ? { background: 'var(--success)', color: 'var(--text-on-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }
        : { background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }),
      ...style,
    }}
  >
    <ShieldCheck size={size === 'sm' ? 12 : 15} /> Verified
  </span>
);
