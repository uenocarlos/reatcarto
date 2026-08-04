import React from 'react';

export default function DecorativeFrame({ children, className = '' }) {
  return (
    <div className={`export-decorative-frame ${className}`.trim()} data-testid="export-decorative-frame">
      {children}
    </div>
  );
}
