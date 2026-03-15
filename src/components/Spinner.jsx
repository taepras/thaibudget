import React from 'react';

function Spinner({ size = 36, thickness = 3 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `${thickness}px solid rgba(255,255,255,0.15)`,
      borderTopColor: 'rgba(255,255,255,0.85)',
      borderRadius: '50%',
      animation: '_tm_spin 0.7s linear infinite',
    }} />
  );
}

export default Spinner;
