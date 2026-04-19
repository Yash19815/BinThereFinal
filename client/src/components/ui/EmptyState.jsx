import React from 'react';

export default function EmptyState({ title, description, icon, children }) {
  return (
    <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1rem', textAlign: 'center', color: 'var(--text2)' }}>
      {icon && <div className="empty-state-icon" style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.6 }}>{icon}</div>}
      <h3 className="empty-state-title" style={{ fontSize: '1.25rem', color: 'var(--text)', marginBottom: '0.5rem', fontWeight: 600 }}>{title}</h3>
      {description && <p className="empty-state-desc" style={{ maxWidth: '400px', lineHeight: 1.5, margin: 0 }}>{description}</p>}
      {children && <div className="empty-state-action" style={{ marginTop: '1.5rem' }}>{children}</div>}
    </div>
  );
}
