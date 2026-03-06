'use client';

import React from 'react';

interface GlowEffectProps {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  width?: string;
  height?: string;
  blur?: string;
  opacity?: number;
  transform?: string;
}

export function GlowEffect({
  top,
  right,
  bottom,
  left,
  width = '650px',
  height = '650px',
  blur = '90px',
  opacity = 0.9,
  transform
}: GlowEffectProps) {
  const position: React.CSSProperties = {};
  if (top) position.top = top;
  if (right) position.right = right;
  if (bottom) position.bottom = bottom;
  if (left) position.left = left;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        ...position,
        width,
        height,
        background: 'radial-gradient(circle, rgba(255,255,255,0.6) 0%, rgba(37,99,235,0.5) 20%, rgba(29,78,216,0.4) 40%, transparent 70%)',
        transform: transform || 'translate(-50%, -50%)',
        zIndex: 0,
        filter: `blur(${blur})`,
        opacity
      }}
    />
  );
}

