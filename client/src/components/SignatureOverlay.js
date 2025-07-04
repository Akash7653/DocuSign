import React, { useState } from 'react';

const SignatureOverlay = ({ onPlace }) => {
  const [position, setPosition] = useState(null);

  const handleClick = (e) => {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPosition({ x, y });

    // Send position to parent
    onPlace({ x, y, page: 1 }); // Assuming page 1 for now
  };

  return (
    <div
      onClick={handleClick}
      className="absolute top-0 left-0 w-full h-full z-50 cursor-crosshair"
      style={{ background: 'rgba(0,0,0,0.05)' }}
    >
      {position && (
        <div
          style={{
            position: 'absolute',
            top: position.y,
            left: position.x,
            width: '100px',
            height: '40px',
            background: 'rgba(255, 0, 0, 0.6)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '5px',
          }}
        >
          Signature
        </div>
      )}
    </div>
  );
};

export default SignatureOverlay;
