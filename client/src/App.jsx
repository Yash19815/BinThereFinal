import { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ALERT_THRESHOLD = 80; // % — show notification

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLevel(pct) {
  if (pct === null || pct === undefined) return "unknown";
  if (pct < 10) return "empty";
  if (pct < 50) return "low";
  if (pct < 80) return "medium";
  if (pct < 95) return "high";
  return "full";
}

function getStatusLabel(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct < 10) return "Empty";
  if (pct < 50) return "Low";
  if (pct < 80) return "Medium";
  if (pct < 95) return "High";
  return "Full";
}

function timeAgo(isoString) {
  if (!isoString) return "No data yet";
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CompartmentPanel({ label, data, darkMode }) {
  const pct = data?.fill_level_percent ?? null;
  const level = getLevel(pct);

  return (
    <div className={`compartment-panel ${level}`}>
      <div className="comp-header">
        <span className="comp-label">{label}</span>
        <span className={`status-pill ${level}`}>{getStatusLabel(pct)}</span>
      </div>

      <div className="fill-visual">
        <div className="fill-tube">
          <div
            className={`fill-liquid ${level}`}
            style={{ height: `${pct ?? 0}%` }}
          />
          <div className="fill-marks">
            {[75, 50, 25].map((m) => (
              <span key={m} className="fill-mark" style={{ bottom: `${m}%` }}>
                <span className="fill-mark-line" />
                <span className="fill-mark-label">{m}%</span>
              </span>
            ))}
          </div>
        </div>
        <div className="fill-pct-label">
          <span className="big-pct">
            {pct !== null ? `${pct.toFixed(0)}%` : "—"}
          </span>
          <span className="dist-label">
            {data?.raw_distance_cm !== undefined
              ? `${data.raw_distance_cm} cm`
              : ""}
          </span>
        </div>
      </div>

      <div className="comp-footer">
        <span className="last-updated-label">Updated</span>
        <span className="last-updated-val">{timeAgo(data?.last_updated)}</span>
      </div>
    </div>
  );
}

function BinCard({ bin, onClick }) {
  const dryPct = bin?.dry?.fill_level_percent ?? null;
  const wetPct = bin?.wet?.fill_level_percent ?? null;
  const maxPct = Math.max(dryPct ?? 0, wetPct ?? 0);
  const isAlert = maxPct >= ALERT_THRESHOLD;

  return (
    <div className={`bin-card ${isAlert ? "bin-alert" : ""}`} onClick={onClick}>
      <div className="bin-card-header">
        <div className="bin-icon">🗑️</div>
        <div className="bin-meta">
          <h2 className="bin-name">{bin.name}</h2>
          <p className="bin-location">📍 {bin.location}</p>
        </div>
        {isAlert && <span className="alert-chip">⚠ Alert</span>}
      </div>

      <div className="compartments-row">
        <CompartmentPanel label="🌫 Dry Waste" data={bin.dry} />
        <div className="compartment-divider" />
        <CompartmentPanel label="💧 Wet Waste" data={bin.wet} />
      </div>

      <div className="bin-card-footer">
        <span className="overall-label">Max fill</span>
        <div className="overall-bar-wrap">
          <div
            className={`overall-bar ${getLevel(maxPct)}`}
            style={{ width: `${maxPct}%` }}
          />
        </div>
        <span className="overall-pct">{maxPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

function NotificationPanel({ bins, onClose }) {
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

function HistoryModal({ bin, history, onClose }) {
  if (!bin) return null;

  const dryHistory = history
    .filter((h) => h.compartment === "dry")
    .slice(0, 15)
    .reverse();
  const wetHistory = history
    .filter((h) => h.compartment === "wet")
    .slice(0, 15)
    .reverse();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{bin.name} — History</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-charts">
          <HistoryChart
            label="🌫 Dry Waste"
            entries={dryHistory}
            color="#3b82f6"
          />
          <HistoryChart
            label="💧 Wet Waste"
            entries={wetHistory}
            color="#8b5cf6"
          />
        </div>

        <div className="modal-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Compartment</th>
                <th>Distance</th>
                <th>Fill %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 30).map((h, i) => (
                <tr key={i}>
                  <td>{formatTime(h.timestamp)}</td>
                  <td className="cap">{h.compartment}</td>
                  <td>{h.raw_distance_cm} cm</td>
                  <td>{h.fill_level_percent.toFixed(1)}%</td>
                  <td>
                    <span
                      className={`status-pill ${getLevel(h.fill_level_percent)}`}
                    >
                      {getStatusLabel(h.fill_level_percent)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HistoryChart({ label, entries, color }) {
  if (entries.length === 0)
    return (
      <div className="chart-wrap">
        <p className="chart-label">{label}</p>
        <p className="chart-empty">No data yet</p>
      </div>
    );

  const max = 100;
  const w = 320,
    h = 100,
    pad = 8;
  const pts = entries
    .map((e, i) => {
      const x = pad + (i / Math.max(entries.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (e.fill_level_percent / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const fillPts = [
    `${pad},${h - pad}`,
    ...entries.map((e, i) => {
      const x = pad + (i / Math.max(entries.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (e.fill_level_percent / max) * (h - pad * 2);
      return `${x},${y}`;
    }),
    `${w - pad},${h - pad}`,
  ].join(" ");

  return (
    <div className="chart-wrap">
      <p className="chart-label">{label}</p>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="chart-svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`grad-${color.replace("#", "")}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={fillPts}
          fill={`url(#grad-${color.replace("#", "")})`}
        />
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {entries.map((e, i) => {
          const x = pad + (i / Math.max(entries.length - 1, 1)) * (w - pad * 2);
          const y = h - pad - (e.fill_level_percent / max) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
      <div className="chart-range">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

function Header({ bins, darkMode, onToggleDark, wsStatus }) {
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
                <strong>Admin User</strong>
                <span>admin@binthere.io</span>
                <span className="role-tag">Admin</span>
              </div>
              <div className="profile-action">
                <span>☀ Dark Mode</span>
                <button
                  className={`toggle-btn ${darkMode ? "on" : ""}`}
                  onClick={onToggleDark}
                  aria-label="Toggle dark mode"
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [bins, setBins] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedBin, setSelectedBin] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("dark") === "true",
  );
  const [wsStatus, setWsStatus] = useState("connecting");
  const wsRef = useRef(null);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("dark", darkMode);
  }, [darkMode]);

  // Initial REST fetch
  const fetchBins = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bins`);
      const json = await res.json();
      if (json.bins) setBins(json.bins);
    } catch {
      /* server may be starting */
    }
  }, []);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // WebSocket for real-time updates
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => setWsStatus("connected");
      ws.onclose = () => {
        setWsStatus("disconnected");
        setTimeout(connect, 3000);
      };
      ws.onerror = () => {};

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.type === "state" || msg.type === "update") {
          setBins((prev) => {
            const idx = prev.findIndex((b) => b.id === msg.bin.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = msg.bin;
              return next;
            }
            return [...prev, msg.bin];
          });
        }
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  const openDetail = async (bin) => {
    setSelectedBin(bin);
    try {
      const res = await fetch(`${API_URL}/api/bins/${bin.id}`);
      const json = await res.json();
      setHistory(json.history || []);
    } catch {
      setHistory([]);
    }
  };

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <Header
        bins={bins}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((p) => !p)}
        wsStatus={wsStatus}
      />

      <main className="main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Smart Dustbin Monitor</h1>
            <p className="page-sub">
              Real-time fill levels via ultrasonic sensors
            </p>
          </div>
          <button className="refresh-btn" onClick={fetchBins} title="Refresh">
            ↻ Refresh
          </button>
        </div>

        {bins.length === 0 ? (
          <div className="empty-state">
            <div className="pulse-ring" />
            <p>Waiting for sensor data…</p>
            <p className="hint">
              Make sure the backend is running and the ESP32 is sending data.
            </p>
          </div>
        ) : (
          <div className="bin-grid">
            {bins.map((bin) => (
              <BinCard key={bin.id} bin={bin} onClick={() => openDetail(bin)} />
            ))}
          </div>
        )}
      </main>

      {selectedBin && (
        <HistoryModal
          bin={selectedBin}
          history={history}
          onClose={() => {
            setSelectedBin(null);
            setHistory([]);
          }}
        />
      )}
    </div>
  );
}
