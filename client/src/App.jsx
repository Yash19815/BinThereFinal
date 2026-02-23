import { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";

// ── Constants ─────────────────────────────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const ALERT_THRESHOLD = 80; // % — show notification

// ── SVG linear path (straight segments — avoids Catmull-Rom overshoot on sparse data) ───
function linearPath(points) {
  if (points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

// ── Analytics Section ─────────────────────────────────────────────────────────
function AnalyticsSection({ binId, refreshKey }) {
  const [data, setData] = useState(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/bins/${binId}/analytics?range=${range}`,
      );
      const json = await res.json();
      if (json.status === "success") setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [binId, range, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart geometry
  const W = 680,
    H = 220,
    PL = 44,
    PR = 16,
    PT = 16,
    PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const hasData = data && data.labels.length > 0;
  const hasAnyFill =
    hasData && [...(data.dry || []), ...(data.wet || [])].some((v) => v > 0);

  // Compute y-scale — counts are small integers, not percentages
  const allVals = hasData
    ? [...(data.dry || []), ...(data.wet || [])].filter((v) => v !== null)
    : [];
  const rawMax = allVals.length ? Math.max(...allVals) : 0;
  const yMax = Math.max(Math.ceil(rawMax) + 1, 5); // at least 5 so chart isn't flat
  const yMin = 0;

  function toPoint(i, val, len) {
    const x = PL + (i / Math.max(len - 1, 1)) * chartW;
    const y = PT + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
    return { x, y };
  }

  function buildSeries(series, len) {
    if (!series) return [];
    return series.map((v, i) => (v !== null ? toPoint(i, v, len) : null));
  }

  function seriesPath(points) {
    const segments = [];
    let segment = [];
    for (const pt of points) {
      if (pt) {
        segment.push(pt);
      } else {
        if (segment.length) segments.push(segment);
        segment = [];
      }
    }
    if (segment.length) segments.push(segment);
    // Use straight lines — smooth curves overshoot on sparse integer data
    return segments.map((seg) => linearPath(seg)).join(" ");
  }

  function areaPath(points, len, series) {
    if (!series) return "";
    const validPts = points.filter(Boolean);
    if (validPts.length < 2) return "";
    const pathD = seriesPath(points);
    if (!pathD) return "";
    const first = validPts[0];
    const last = validPts[validPts.length - 1];
    return `${pathD} L ${last.x} ${PT + chartH} L ${first.x} ${PT + chartH} Z`;
  }

  const len = hasData ? data.labels.length : 0;
  const dryPts = hasData ? buildSeries(data.dry, len) : [];
  const wetPts = hasData ? buildSeries(data.wet, len) : [];

  // Y-axis grid: use integer steps
  const yTicks = [];
  const step = yMax <= 10 ? 1 : yMax <= 20 ? 2 : 5;
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  // X-axis labels (show at most 8)
  const xLabels = hasData ? data.labels : [];
  const xStep = Math.max(1, Math.ceil(xLabels.length / 8));

  return (
    <div className="analytics-section">
      {/* Header row */}
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Garbage Collection Analytics</h2>
          <p className="analytics-sub">Today's fill count per compartment</p>
        </div>
      </div>

      <div className="analytics-body">
        {/* Chart panel */}
        <div className="analytics-chart-panel">
          {/* Range selector */}
          <div className="range-select-wrap">
            <select
              className="range-select"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
            >
              <option value={7}>Last Week</option>
              <option value={14}>Last 2 Weeks</option>
              <option value={30}>Last Month</option>
            </select>
          </div>

          {/* SVG chart */}
          <div className="chart-container">
            {loading && <div className="chart-loading">Loading…</div>}

            {!data && !loading ? (
              <div className="chart-nodata">
                <p>Could not load analytics — is the server running?</p>
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                ref={svgRef}
                className="analytics-svg"
                preserveAspectRatio="xMidYMid meet"
                onMouseMove={(e) => {
                  const svg = svgRef.current;
                  if (!svg || !hasData) return;
                  const rect = svg.getBoundingClientRect();
                  const scaleX = W / rect.width;
                  const mouseX = (e.clientX - rect.left) * scaleX;
                  // Find nearest data point index by x position
                  let closest = 0,
                    minDist = Infinity;
                  for (let i = 0; i < len; i++) {
                    const pt = dryPts[i] || wetPts[i];
                    if (!pt) continue;
                    const dist = Math.abs(pt.x - mouseX);
                    if (dist < minDist) {
                      minDist = dist;
                      closest = i;
                    }
                  }
                  setHoveredIdx(closest);
                }}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <defs>
                  <linearGradient id="grad-dry" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="grad-wet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Grid lines + Y labels */}
                {yTicks.map((v) => {
                  const y = PT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
                  return (
                    <g key={v}>
                      <line
                        x1={PL}
                        y1={y}
                        x2={W - PR}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.08"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={PL - 6}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="currentColor"
                        opacity="0.45"
                      >
                        {v}
                      </text>
                    </g>
                  );
                })}

                {/* Y-axis label */}
                <text
                  x={10}
                  y={PT + chartH / 2}
                  textAnchor="middle"
                  fontSize="10"
                  fill="currentColor"
                  opacity="0.45"
                  transform={`rotate(-90, 10, ${PT + chartH / 2})`}
                >
                  Fill Count
                </text>

                {/* X-axis labels */}
                {xLabels.map((lbl, i) => {
                  if (i % xStep !== 0 && i !== xLabels.length - 1) return null;
                  const x = PL + (i / Math.max(len - 1, 1)) * chartW;
                  return (
                    <text
                      key={i}
                      x={x}
                      y={H - 4}
                      textAnchor="middle"
                      fontSize="10"
                      fill="currentColor"
                      opacity="0.5"
                    >
                      {lbl}
                    </text>
                  );
                })}

                {/* Area fills */}
                <path
                  d={areaPath(dryPts, len, data?.dry)}
                  fill="url(#grad-dry)"
                />
                <path
                  d={areaPath(wetPts, len, data?.wet)}
                  fill="url(#grad-wet)"
                />

                {/* Lines */}
                <path
                  d={seriesPath(dryPts)}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d={seriesPath(wetPts)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Dots — highlighted on hover */}
                {dryPts.map(
                  (pt, i) =>
                    pt && (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIdx === i ? 6.5 : 4.5}
                        fill="#f59e0b"
                        stroke="white"
                        strokeWidth="1.5"
                        style={{ transition: "r 0.1s" }}
                      />
                    ),
                )}
                {wetPts.map(
                  (pt, i) =>
                    pt && (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={hoveredIdx === i ? 6.5 : 4.5}
                        fill="#3b82f6"
                        stroke="white"
                        strokeWidth="1.5"
                        style={{ transition: "r 0.1s" }}
                      />
                    ),
                )}

                {/* Hover tooltip */}
                {hoveredIdx !== null &&
                  (() => {
                    const dryPt = dryPts[hoveredIdx];
                    const wetPt = wetPts[hoveredIdx];
                    const anchorPt = dryPt || wetPt;
                    if (!anchorPt) return null;
                    const dryVal = data?.dry?.[hoveredIdx] ?? 0;
                    const wetVal = data?.wet?.[hoveredIdx] ?? 0;
                    const label = xLabels[hoveredIdx] ?? "";
                    // Tooltip dimensions
                    const TW = 110,
                      TH = 60,
                      TR = 6;
                    let tx = anchorPt.x - TW / 2;
                    let ty = anchorPt.y - TH - 12;
                    // Clamp to SVG bounds
                    if (tx < PL) tx = PL;
                    if (tx + TW > W - PR) tx = W - PR - TW;
                    if (ty < 4) ty = anchorPt.y + 14;
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        {/* Vertical crosshair */}
                        <line
                          x1={anchorPt.x}
                          y1={PT}
                          x2={anchorPt.x}
                          y2={PT + chartH}
                          stroke="currentColor"
                          strokeOpacity="0.18"
                          strokeWidth="1"
                          strokeDasharray="4 3"
                        />
                        {/* Tooltip box */}
                        <rect
                          x={tx}
                          y={ty}
                          width={TW}
                          height={TH}
                          rx={TR}
                          ry={TR}
                          fill="var(--surface2)"
                          stroke="var(--border)"
                          strokeWidth="1"
                          style={{
                            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18))",
                          }}
                        />
                        <text
                          x={tx + TW / 2}
                          y={ty + 14}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="600"
                          fill="currentColor"
                          opacity="0.7"
                        >
                          {label}
                        </text>
                        <circle
                          cx={tx + 16}
                          cy={ty + 29}
                          r="4"
                          fill="#f59e0b"
                        />
                        <text
                          x={tx + 24}
                          y={ty + 33}
                          fontSize="10"
                          fill="currentColor"
                          opacity="0.8"
                        >
                          Dry
                        </text>
                        <text
                          x={tx + TW - 8}
                          y={ty + 33}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="700"
                          fill="#f59e0b"
                        >
                          {dryVal}
                        </text>
                        <circle
                          cx={tx + 16}
                          cy={ty + 47}
                          r="4"
                          fill="#3b82f6"
                        />
                        <text
                          x={tx + 24}
                          y={ty + 51}
                          fontSize="10"
                          fill="currentColor"
                          opacity="0.8"
                        >
                          Wet
                        </text>
                        <text
                          x={tx + TW - 8}
                          y={ty + 51}
                          textAnchor="end"
                          fontSize="11"
                          fontWeight="700"
                          fill="#3b82f6"
                        >
                          {wetVal}
                        </text>
                      </g>
                    );
                  })()}
              </svg>
            )}
            {/* Overlay: data loaded but no fill cycles in this period */}
            {hasData && !hasAnyFill && !loading && (
              <div className="chart-nodata chart-nodata--overlay">
                <p>🗑️ No fill cycles yet in this period</p>
                <p style={{ fontSize: "0.78rem", opacity: 0.6 }}>
                  Fill events are recorded when the bin reaches ≥ 95%
                </p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="analytics-legend">
            <span className="legend-item dry">
              <span className="legend-dot" />
              Dry Waste
            </span>
            <span className="legend-item wet">
              <span className="legend-dot" />
              Wet Waste
            </span>
          </div>
        </div>

        {/* Side stats panel */}
        <div className="analytics-stats">
          {data?.latest?.date && (
            <>
              <p className="stats-label">Latest</p>
              <p className="stats-date">{data.latest.date}</p>
            </>
          )}
          <div className="stats-item wet">
            <span className="stats-dot" style={{ background: "#3b82f6" }} />
            <span className="stats-name">Wet Waste</span>
            <span className="stats-val" style={{ color: "#3b82f6" }}>
              {data?.latest?.wet !== null && data?.latest?.wet !== undefined
                ? `${data.latest.wet}`
                : "—"}
            </span>
          </div>
          <div className="stats-item dry">
            <span className="stats-dot" style={{ background: "#f59e0b" }} />
            <span className="stats-name">Dry Waste</span>
            <span className="stats-val" style={{ color: "#f59e0b" }}>
              {data?.latest?.dry !== null && data?.latest?.dry !== undefined
                ? `${data.latest.dry}`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [analyticsKey, setAnalyticsKey] = useState(0); // bumped on every WS update
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
          // Nudge analytics to re-fetch on every incoming measurement
          if (msg.type === "update") setAnalyticsKey((k) => k + 1);
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
          <>
            <AnalyticsSection binId={1} refreshKey={analyticsKey} />
            <div className="bin-grid">
              {bins.map((bin) => (
                <BinCard
                  key={bin.id}
                  bin={bin}
                  onClick={() => openDetail(bin)}
                />
              ))}
            </div>
          </>
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
