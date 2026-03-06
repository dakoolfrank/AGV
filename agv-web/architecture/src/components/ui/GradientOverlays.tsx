'use client';

export function GradientOverlays() {
  const gradientStyle = {
    background: 'radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(59,130,246,0.6) 12%, rgba(59,130,246,0.4) 25%, rgba(59,130,246,0.2) 40%, rgba(0,0,0,0.2) 60%, transparent 85%)',
    width: '3000px',
    height: '3000px',
    zIndex: 0,
    opacity: 0.7
  };

  return (
    <>
      {/* Top Center Gradient */}
      <div
        className="fixed pointer-events-none"
        style={{
          ...gradientStyle,
          top: '0px',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Middle Right Gradient */}
      <div
        className="fixed pointer-events-none"
        style={{
          ...gradientStyle,
          top: '50%',
          right: '0px',
          transform: 'translate(50%, -50%)',
        }}
      />
      
      {/* Middle Left Gradient */}
      <div
        className="fixed pointer-events-none"
        style={{
          ...gradientStyle,
          top: '50%',
          left: '0px',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Bottom Center Gradient */}
      <div
        className="fixed pointer-events-none"
        style={{
          ...gradientStyle,
          bottom: '0px',
          left: '50%',
          transform: 'translate(-50%, 50%)',
        }}
      />
    </>
  );
}

