import React from 'react';

export default function Skeleton({ width = '100%', height = '100%', borderRadius = '4px', style = {} }) {
  return (
    <div 
      className="skeleton" 
      style={{
        width,
        height,
        borderRadius,
        ...style
      }} 
    />
  );
}

export function BinCardSkeleton() {
  return (
    <div className="bin-card skeleton-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}>
      <div className="bin-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="120px" height="24px" style={{ marginBottom: '8px' }} />
          <Skeleton width="200px" height="16px" />
        </div>
        <Skeleton width="24px" height="24px" borderRadius="12px" />
      </div>
      <div className="compartments-row" style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="100%" height="80px" borderRadius="6px" />
        </div>
        <div style={{ flex: 1 }}>
          <Skeleton width="100%" height="80px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
}
