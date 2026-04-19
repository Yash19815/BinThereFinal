import React, { useState } from 'react';
import NotificationPanel from './NotificationPanel';
import { ALERT_THRESHOLD } from '../../utils/constants';

/**
 * Application header bar containing the logo, WebSocket status indicator,
 * notification bell with dropdown, and a profile menu.
 */
export default function Header({ bins, wsStatus, user, onLogout }) {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const alertCount = bins.filter(
    (b) =>
      Math.max(
        b.dry?.fill_level_percent ?? 0,
        b.wet?.fill_level_percent ?? 0,
      ) >= ALERT_THRESHOLD,
  ).length;

  return (
    <header className="app-header">
      <div className="header-logo">
        <img
          className="logo-icon"
          src="/47983e4f2244acd2659cb948cc4e3431517267ad.png"
          alt="BinThere Logo"
        />
      </div>

      <div className="header-actions">
        <span
          className={`ws-dot ${wsStatus}`}
          title={`WebSocket: ${wsStatus}`}
        />

        {/* Notifications */}
        <div className="icon-btn-wrap">
          <button
            className="icon-btn"
            onClick={() => {
              setShowNotif((p) => !p);
              setShowProfile(false);
            }}
          >
            🔔
            {alertCount > 0 && <span className="badge">{alertCount}</span>}
          </button>
          {showNotif && (
            <NotificationPanel
              bins={bins}
              onClose={() => setShowNotif(false)}
            />
          )}
        </div>

        {/* Profile */}
        <div className="icon-btn-wrap">
          <button
            className="icon-btn profile-btn"
            onClick={() => {
              setShowProfile((p) => !p);
              setShowNotif(false);
            }}
          >
            👤
          </button>
          {showProfile && (
            <div className="profile-dropdown">
              <div className="profile-info">
                <strong>{user?.username ?? "Admin User"}</strong>
                <span className="role-tag">{user?.role ?? "admin"}</span>
              </div>

              <div className="profile-action profile-logout">
                <button
                  className="logout-btn"
                  onClick={() => {
                    setShowProfile(false);
                    onLogout();
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
