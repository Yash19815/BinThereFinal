import React from 'react';

export default function InlineError({ message, onRetry }) {
  return (
    <div className="inline-error" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'var(--surface2)', borderLeft: '4px solid var(--danger)', borderRadius: '4px', color: 'var(--text)' }}>
      <span className="error-icon" aria-hidden="true">⚠️</span>
      <span className="error-msg" style={{ flex: 1, fontSize: '0.9rem' }}>{message}</span>
      {onRetry && (
        <button 
          className="error-retry" 
          onClick={onRetry}
          style={{ whiteSpace: 'nowrap', padding: '0.25rem 0.75rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text)', cursor: 'pointer' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
