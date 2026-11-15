import React from 'react';
import { BadgeCheck } from 'lucide-react';

/** "Verified" chip for listings staff have checked (listing.verifiedAt). */
export const VerifiedBadge: React.FC<{ size?: 'sm' | 'md'; overlay?: boolean; style?: React.CSSProperties }> = ({ size = 'sm', overlay, style }) => (
  <span
    title="Verified by Becho"
    className={`chip chip-upper ${overlay ? 'chip-solid-success' : 'chip-success'}`}
    style={{ fontSize: size === 'sm' ? '0.66rem' : '0.74rem', padding: size === 'sm' ? '3px 8px' : '4px 10px', ...style }}
  >
    <BadgeCheck size={size === 'sm' ? 12 : 14} /> Verified
  </span>
);
