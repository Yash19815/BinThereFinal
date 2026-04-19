import React from 'react';
import { ALERT_THRESHOLD } from '../../utils/constants';

/**
 * Dropdown panel listing bins whose fill level exceeds ALERT_THRESHOLD.
 * Renders a count badge in its header and one notification item per critical bin.
 * Shown when the notification bell button in the Header is clicked.
 *
 * @param {{ bins: object[], onClose: () => void }} props
 */
export default function NotificationPanel({ bins, onClose }) {
  const alerts = bins.filter((b) => {
    const m = Math.max(
      b.dry?.fill_level_percent ?? 0,
      b.wet?.fill_level_percent ?? 0,
    );
    return m >= ALERT_THRESHOLD;
  });

  return (
    <div className="notif-dropdown">
      <div className="notif-header">
        <span>
          Notifications{" "}
          {alerts.length > 0 && (
            <span className="notif-count">{alerts.length}</span>
          )}
        </span>
        <button className="notif-clear" onClick={onClose}>
          Clear All
        </button>
      </div>
      {alerts.length === 0 ? (
        <p className="notif-empty">No critical alerts 🎉</p>
      ) : (
        alerts.map((b) => {
          const pct = Math.max(
            b.dry?.fill_level_percent ?? 0,
            b.wet?.fill_level_percent ?? 0,
          );
          return (
            <div key={b.id} className="notif-item">
              <span className="notif-dot" />
              <div>
                <p className="notif-title">{b.name} is critically full</p>
                <p className="notif-sub">
                  {b.location} • {pct.toFixed(0)}% capacity
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
