/**
 * @fileoverview BinThere – React Dashboard (App.jsx)
 *
 * Single-page dashboard for monitoring a smart dustbin in real time.
 *
 * Architecture:
 *  - <App>              Root component; owns WebSocket connection and global state
 *  - <Header>           Navigation bar: WS status dot, notifications, dark-mode toggle
 *  - <AnalyticsSection> Line chart of daily fill-cycle counts (dry vs wet)
 *  - <BinCard>          Summary card per bin with fill-tube visual
 *  - <CompartmentPanel> Individual dry / wet compartment display inside a BinCard
 *  - <HistoryModal>     Modal sheet with 30-row measurement table + mini line chart
 *  - <HistoryChart>     Small SVG line chart used inside HistoryModal
 *  - <NotificationPanel> Dropdown listing bins that exceed ALERT_THRESHOLD
 *
 * Data flow:
 *  1. On mount: REST GET /api/bins populates bin list
 *  2. WebSocket messages (type:"state"|"update") patch the bins array in-place
 *  3. Every "update" message increments analyticsKey, which triggers
 *     AnalyticsSection to re-fetch its analytics endpoint
 *
 * Environment variables (set in client/.env):
 *  VITE_WS_URL  – WebSocket server URL (default: ws://localhost:3001)
 *  VITE_API_URL – REST API base URL   (default: http://localhost:3001)
 */
import React, { useEffect, useState, useRef, useCallback } from "react";
import "./App.css";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import ExportToExcel from "./components/ExportToExcel";

// ── Constants ─────────────────────────────────────────────────────────────────
// Detect the current host (e.g., 192.168.1.8 or localhost)
const CURRENT_HOST = window.location.hostname;

// Prioritize .env values, otherwise use the auto-detected host
const WS_URL = `ws://${CURRENT_HOST}:3001` || import.meta.env.VITE_WS_URL;

const API_URL = `http://${CURRENT_HOST}:3001` || import.meta.env.VITE_API_URL;

const ALERT_THRESHOLD = 80; // % — show notification
/**
 * Returns the common auth headers to attach to every API fetch.
 * @param {string|null} token - JWT token from AuthContext
 * @returns {Record<string, string>}
 */
function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── SVG Utilities ────────────────────────────────────────────────────────────
/**
 * Converts an array of {x, y} SVG coordinates into an SVG path string using
 * straight line segments (M x y L x1 y1 …).
 *
 * Rationale: Catmull-Rom splines look nice with dense data but produce
 * undesirable overshooting curves when data is sparse (e.g. all-zero days
 * with a single spike). Linear paths are always accurate for count data.
 *
 * @param {{ x: number, y: number }[]} points - Ordered array of SVG coordinates
 * @returns {string} SVG path data string, or "" if fewer than 2 points
 */
function linearPath(points) {
  if (points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

// ── Analytics Section ────────────────────────────────────────────────────────
/**
 * Displays the fill-cycle analytics chart and today's summary stats.
 *
 * Re-fetches data when:
 *  - The selected date range (range state) changes
 *  - refreshKey changes (passed from App on every WebSocket "update" message)
 *
 * Chart uses two SVG line series (dry = amber, wet = blue) with gradient fills,
 * dot markers at each data point, a dashed vertical crosshair on hover, and a
 * floating tooltip showing the date label + individual counts.
 *
 * @param {{ binId: number, refreshKey: number, token: string|null }} props
 *   binId      – Database ID of the bin to fetch analytics for
 *   refreshKey – Monotonically increasing counter; increment to trigger a refetch
 *   token      – JWT auth token for the Authorization header
 */
function AnalyticsSection({ binId, refreshKey, token, darkMode }) {
  const [data, setData] = useState(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  /**
   * Fetches analytics data from GET /api/bins/:id/analytics?range=<n>.
   * Wrapped in useCallback with [binId, range, refreshKey] deps so it only
   * re-creates (and re-runs via the useEffect below) when those values change.
   */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/bins/${binId}/analytics?range=${range}`,
        { headers: authHeaders(token) },
      );
      const json = await res.json();
      if (json.status === "success") setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [binId, range, refreshKey, token]);

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

  /**
   * Maps a (index, value) pair to an SVG {x, y} coordinate within the chart area.
   * Index 0 → left edge (PL), index len-1 → right edge.
   * Value 0 → bottom of chart area (PT + chartH), value yMax → top (PT).
   *
   * @param {number} i   - 0-based index in the data array
   * @param {number} val - Y value (fill cycle count)
   * @param {number} len - Total number of data points (for x-spacing)
   * @returns {{ x: number, y: number }}
   */
  function toPoint(i, val, len) {
    const x = PL + (i / Math.max(len - 1, 1)) * chartW;
    const y = PT + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
    return { x, y };
  }

  /**
   * Converts a raw data array into an array of SVG points (or null for missing values).
   * Null entries break the line path so gaps (missing data) render as discontinuities
   * rather than straight lines to zero.
   *
   * @param {(number|null)[]} series - Raw data values from the API
   * @param {number}          len    - Total number of labels/days
   * @returns {({ x: number, y: number } | null)[]}
   */
  function buildSeries(series, len) {
    if (!series) return [];
    return series.map((v, i) => (v !== null ? toPoint(i, v, len) : null));
  }

  /**
   * Builds the SVG \"d\" attribute for a line series, splitting at null points so
   * that data gaps produce separate sub-paths rather than a line through zero.
   *
   * Each contiguous run of non-null points becomes one linearPath() segment.
   * Multiple segments are joined into one \"d\" string with a space.
   *
   * @param {({ x: number, y: number } | null)[]} points
   * @returns {string} SVG path \"d\" attribute
   */
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

  /**
   * Builds the closed SVG path for a gradient fill area beneath the line series.
   * Extends the line path down to the chart baseline and back to the start to form
   * a closed polygon, which is then filled with a gradient (see <defs>).
   *
   * Returns "" if there are fewer than 2 valid points (no visible area to fill).
   *
   * @param {({ x: number, y: number } | null)[]} points - Output of buildSeries()
   * @param {number}          len    - Total number of labels (unused but kept for clarity)
   * @param {(number|null)[]} series - Original data array (null check guard)
   * @returns {string} SVG path \"d\" attribute for the filled area
   */
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
                    <stop 
                      offset="0%" 
                      stopColor={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"} 
                      stopOpacity="0.25" 
                    />
                    <stop 
                      offset="100%" 
                      stopColor={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"} 
                      stopOpacity="0" 
                    />
                  </linearGradient>
                  <linearGradient id="grad-wet" x1="0" y1="0" x2="0" y2="1">
                    <stop 
                      offset="0%" 
                      stopColor={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"} 
                      stopOpacity="0.2" 
                    />
                    <stop 
                      offset="100%" 
                      stopColor={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"} 
                      stopOpacity="0" 
                    />
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
                  stroke={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d={seriesPath(wetPts)}
                  fill="none"
                  stroke={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"}
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
                        fill={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"}
                        stroke={darkMode ? "#1a1d2e" : "white"}
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
                        fill={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"}
                        stroke={darkMode ? "#1a1d2e" : "white"}
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
                          fill={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"}
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
                          fill={darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)"}
                        >
                          {dryVal}
                        </text>
                        <circle
                          cx={tx + 16}
                          cy={ty + 47}
                          r="4"
                          fill={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"}
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
                          fill={darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)"}
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
            <span className="stats-dot" style={{ background: darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)" }} />
            <span className="stats-name">Wet Waste</span>
            <span className="stats-val" style={{ color: darkMode ? "hsl(145, 72%, 58%)" : "hsl(140, 65%, 40%)" }}>
              {data?.latest?.wet !== null && data?.latest?.wet !== undefined
                ? `${data.latest.wet}`
                : "—"}
            </span>
          </div>
          <div className="stats-item dry">
            <span className="stats-dot" style={{ background: darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)" }} />
            <span className="stats-name">Dry Waste</span>
            <span className="stats-val" style={{ color: darkMode ? "hsl(210, 95%, 64%)" : "hsl(210, 80%, 40%)" }}>
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
/**
 * Returns a CSS-safe level string used as a class modifier throughout the UI.
 * Drives colour theming for fill tubes, status pills, and card outlines.
 *
 * @param {number|null} pct - Fill percentage 0–100, or null/undefined if no data
 * @returns {"unknown"|"empty"|"low"|"medium"|"high"|"full"}
 */
function getLevel(pct) {
  if (pct === null || pct === undefined) return "unknown";
  if (pct < 10) return "empty";
  if (pct < 50) return "low";
  if (pct < 80) return "medium";
  if (pct < 95) return "high";
  return "full";
}

/**
 * Returns the human-readable fill status label displayed in the status pill.
 * Mirrors the server-side computeStatus() logic for consistency.
 *
 * @param {number|null} pct - Fill percentage 0–100, or null/undefined
 * @returns {string} "Empty" | "Low" | "Medium" | "High" | "Full" | "—"
 */
function getStatusLabel(pct) {
  if (pct === null || pct === undefined) return "—";
  if (pct < 10) return "Empty";
  if (pct < 50) return "Low";
  if (pct < 80) return "Medium";
  if (pct < 95) return "High";
  return "Full";
}

/**
 * Returns a human-readable relative time string from an ISO-8601 timestamp.
 * Resolves to seconds/minutes/hours since now. Used for the "Updated X ago" label.
 *
 * @param {string|null} isoString - ISO-8601 datetime string from the database
 * @returns {string} e.g. "12s ago", "3m ago", "2h ago", or "No data yet"
 */
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

/**
 * Formats an ISO-8601 timestamp as an IST date string (YYYY-MM-DD).
 * Used in the HistoryModal measurement table.
 *
 * @param {string|null} isoString
 * @returns {string} e.g. "2026-03-23" or "—" if null
 */
function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formats an ISO-8601 timestamp as an IST HH:MM:SS string (24-hour clock).
 * Used in the HistoryModal measurement table.
 *
 * @param {string|null} isoString
 * @returns {string} e.g. "14:32:07" or "—" if null
 */
function formatTime(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Renders one waste compartment (dry or wet) as a vertical fill-tube gauge.
 * Colour and label update dynamically based on the fill level.
 *
 * Visual elements:
 *  - Status pill (Empty → Full) in the header
 *  - Animated fill-liquid bar whose height equals fill_level_percent
 *  - Tick marks at 25 %, 50 %, 75 %
 *  - Large percentage and raw cm distance in the centre
 *  - "Updated X ago" footer
 *
 * @param {{ label: string, data: object|null, darkMode: boolean }} props
 *   label  – Display label, e.g. "🌫 Dry Waste"
 *   data   – Latest compartment reading from the API, or null if never read
 */
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

/**
 * Summary card for a single bin. Shows both compartment panels side-by-side,
 * a combined max-fill progress bar at the bottom, and an alert chip when either
 * compartment exceeds ALERT_THRESHOLD.
 * Clicking the card opens the HistoryModal via the onClick callback.
 *
 * @param {{ bin: object, onClick: () => void }} props
 *   bin     – Full bin object from the API (includes .dry and .wet sub-objects)
 *   onClick – Called when the card is clicked to open the detail modal
 */
function BinCard({ bin, onClick, onEditLocation }) {
  const dryPct = bin?.dry?.fill_level_percent ?? null;
  const wetPct = bin?.wet?.fill_level_percent ?? null;
  const count = (dryPct !== null ? 1 : 0) + (wetPct !== null ? 1 : 0);
  const avgPct = count > 0 ? ((dryPct ?? 0) + (wetPct ?? 0)) / count : 0;
  const maxPct = Math.max(dryPct ?? 0, wetPct ?? 0);
  const isAlert = maxPct >= ALERT_THRESHOLD;

  return (
    <div className={`bin-card ${isAlert ? "bin-alert" : ""}`} onClick={onClick}>
      <div className="bin-card-header">
        <div className="bin-icon">🗑️</div>
        <div className="bin-meta">
          <h2 className="bin-name">{bin.name}</h2>
          <div className="location-row">
            <p className="bin-location">📍 {bin.location}</p>
            <button
              className="edit-loc-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEditLocation(bin);
              }}
              title="Edit Location"
            >
              ✏️
            </button>
          </div>
        </div>
        {isAlert && <span className="alert-chip">⚠ Alert</span>}
      </div>

      <div className="compartments-row">
        <CompartmentPanel label="🌫 Dry Waste" data={bin.dry} />
        <div className="compartment-divider" />
        <CompartmentPanel label="💧 Wet Waste" data={bin.wet} />
      </div>

      <div className="bin-card-footer">
        <span className="overall-label">Avg fill</span>
        <div className="overall-bar-wrap">
          <div
            className={`overall-bar ${getLevel(avgPct)}`}
            style={{ width: `${avgPct}%` }}
          />
        </div>
        <span className="overall-pct">{avgPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

/**
 * Dropdown panel listing bins whose fill level exceeds ALERT_THRESHOLD.
 * Renders a count badge in its header and one notification item per critical bin.
 * Shown when the notification bell button in the Header is clicked.
 *
 * @param {{ bins: object[], onClose: () => void }} props
 *   bins    – All known bins (filtering is done inside the component)
 *   onClose – Called when "Clear All" is clicked (hides the dropdown)
 */
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

/**
 * Full-screen overlay modal showing a bin's measurement history.
 * Content:
 *  - Two <HistoryChart> mini charts (dry and wet), each showing the last 15 readings
 *  - A scrollable table of the last 30 measurements with time, compartment,
 *    distance, fill %, and a status pill
 *
 * Clicking the backdrop (outside the modal box) closes the modal.
 * Propagation is stopped on the inner box so clicks inside don't bubble.
 *
 * @param {{ bin: object|null, history: object[], onClose: () => void }} props
 *   bin     – The bin being inspected; null renders nothing
 *   history – Array of measurement rows from GET /api/bins/:id
 *   onClose – Callback to clear selectedBin and close the modal
 */
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
                <th>Date</th>
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
                  <td>{formatDate(h.timestamp)}</td>
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

/**
 * Small SVG area chart used inside HistoryModal for per-compartment history.
 * Renders a filled gradient polygon beneath a polyline of fill % over time.
 * Each data point is also rendered as a circle dot.
 *
 * Coordinates are calculated so index 0 is on the left and index n-1 on the right,
 * with fill % mapped linearly from bottom (0 %) to top (100 %).
 *
 * @param {{ label: string, entries: object[], color: string }} props
 *   label   – Section heading, e.g. "🌫 Dry Waste"
 *   entries – Measurement rows (must have fill_level_percent), oldest first
 *   color   – Hex colour for the line and dots (e.g. "#3b82f6")
 */
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

/**
 * Application header bar containing the logo, WebSocket status indicator,
 * notification bell with dropdown, and a profile menu with user info,
 * dark-mode toggle, and a Logout button.
 *
 * @param {{ bins: object[], darkMode: boolean, onToggleDark: () => void, wsStatus: string, user: object|null, onLogout: () => void }} props
 */
function Header({ bins, darkMode, onToggleDark, wsStatus, user, onLogout }) {
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
                <strong>{user?.username ?? "Admin User"}</strong>
                <span className="role-tag">{user?.role ?? "admin"}</span>
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

const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

function cellColor(value, max, type = "dry", isDark = false) {
  if (max === 0 || value === 0) {
    return isDark ? "hsl(220, 22%, 14%)" : "hsl(0, 0%, 95%)";
  }

  const intensity = value / max; // 0.0 – 1.0

  if (type === "dry") {
    if (isDark) {
      // Dark mode: hsl(210, 75%, 24%) to hsl(210, 95%, 64%)
      const sat = Math.round(75 + intensity * 20);
      const light = Math.round(24 + intensity * 40);
      return `hsl(210, ${sat}%, ${light}%)`;
    } else {
      // Light mode: White → deep blue
      const lightness = Math.round(95 - intensity * 55); 
      return `hsl(210, 80%, ${lightness}%)`;
    }
  } else {
    if (isDark) {
      // Dark mode: hsl(145, 55%, 22%) to hsl(145, 72%, 58%)
      const sat = Math.round(55 + intensity * 17);
      const light = Math.round(22 + intensity * 36);
      return `hsl(145, ${sat}%, ${light}%)`;
    } else {
      // Light mode: White → deep green
      const lightness = Math.round(95 - intensity * 55);
      return `hsl(140, 65%, ${lightness}%)`;
    }
  }
}

function PeakHoursHeatmap({ binId, token, darkMode }) {
  const [heatmap, setHeatmap] = useState(null);
  const [compartment, setCompartment] = useState("dry"); // 'dry' | 'wet'
  const [tooltip, setTooltip] = useState(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

  useEffect(() => {
    let active = true;
    const params = compartment ? `?compartment=${compartment}` : "";
    fetch(`${API_URL}/api/bins/${binId}/heatmap${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((res) => {
        if (active && res.status === "success") {
          setHeatmap(res);
        }
      });
    return () => { active = false };
  }, [binId, compartment, token]);

  if (!heatmap) return <p style={{ padding: "0 24px" }}>Loading heatmap...</p>;

  const { data, max, weeks } = heatmap;

  return (
    <div className="analytics-section" style={{ marginTop: "24px" }}>
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Peak Fill Hours</h2>
          <p className="analytics-sub">Average fill cycles by time of day</p>
        </div>
        <div className="heatmap-controls range-select-wrap">
          <select
            className="range-select"
            value={compartment}
            onChange={(e) => setCompartment(e.target.value)}
          >
            <option value="dry">Dry Waste</option>
            <option value="wet">Wet Waste</option>
          </select>
        </div>
      </div>
      
      <div className="analytics-body" style={{ padding: "0 24px 24px 24px" }}>
        <div className="heatmap-wrapper">
          <div className="heatmap-meta" style={{ marginBottom: "12px", fontSize: "14px", color: "var(--text-sec)" }}>
            Based on <strong>{weeks}</strong> week{weeks !== 1 ? "s" : ""} of overall data
          </div>

          <div className="heatmap-grid">
            <div className="heatmap-corner" />
            {HOURS.map((h) => (
              <div key={h} className="heatmap-hour-label">{h}</div>
            ))}

            {data.map((row, dayIdx) => (
              <React.Fragment key={dayIdx}>
                <div className="heatmap-day-label">{DAYS[dayIdx]}</div>
                {row.map((value, hourIdx) => (
                  <div
                    key={hourIdx}
                    className="heatmap-cell"
                    style={{ backgroundColor: cellColor(value, max, compartment, darkMode) }}
                    onMouseEnter={(e) => {
                      const rect = e.target.getBoundingClientRect();
                      setTooltip({
                        day:   DAYS[dayIdx],
                        hour:  HOURS[hourIdx],
                        value,
                        // Position relative to the cell
                        x: e.nativeEvent.offsetX,
                        y: e.nativeEvent.offsetY,
                        rect
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>

          {tooltip && (
            <div
              className="heatmap-tooltip"
              style={{ position: 'fixed', top: tooltip.rect.top - 45, left: tooltip.rect.left + 12 }}
            >
              <strong>{tooltip.day} @ {tooltip.hour}</strong>
              <br />
              Avg fills: <strong>{tooltip.value.toFixed(2)}</strong> / week
            </div>
          )}

          <div className="heatmap-legend" style={{ marginTop: "16px" }}>
            <span>0</span>
            <div className="heatmap-legend-bar" style={{
              background: compartment === "dry"
                ? `linear-gradient(to right, ${cellColor(0, max, "dry", darkMode)}, ${cellColor(max || 1, max || 1, "dry", darkMode)})`
                : `linear-gradient(to right, ${cellColor(0, max, "wet", darkMode)}, ${cellColor(max || 1, max || 1, "wet", darkMode)})`
            }} />
            <span>{(max || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
/**
 * Root application component.
 *
 * State:
 *  bins         – Array of bin objects, patched in place by WebSocket messages
 *  history      – Measurements for the currently selected bin (loaded on demand)
 *  selectedBin  – The bin whose HistoryModal is open, or null
 *  darkMode     – Persisted in localStorage under the key "dark"
 *  wsStatus     – "connecting" | "connected" | "disconnected"
 *  analyticsKey – Monotonic counter; bumped on every WS "update" to trigger
 *                  AnalyticsSection refetch without polling
 *
 * Lifecycle:
 *  1. Mount: fetchBins() (REST) + connect() (WebSocket)
 *  2. WS message type "state"  → upserts the bin list (server sends on connect)
 *  3. WS message type "update" → upserts + increments analyticsKey
 *  4. WS disconnects           → auto-reconnects after 3 s
 *  5. Unmount                  → closes the WebSocket cleanly
 */
export default function App() {
  const { user, token, logout, loading: authLoading } = useAuth();
  const [bins, setBins] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedBin, setSelectedBin] = useState(null);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("dark") === "true",
  );
  const [wsStatus, setWsStatus] = useState("connecting");
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [analyticsBinId, setAnalyticsBinId] = useState(1);
  const wsRef = useRef(null);

  // Apply dark mode class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("dark", darkMode);
  }, [darkMode]);

  // Initial REST fetch
  const fetchBins = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/bins`, {
        headers: authHeaders(token),
      });
      const json = await res.json();
      if (json.bins) setBins(json.bins);
    } catch {
      /* server may be starting */
    }
  }, [token]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  // Automatically select the first bin for analytics once bins are populated
  useEffect(() => {
    if (bins.length > 0 && !analyticsBinId) {
      setAnalyticsBinId(bins[0].id);
    }
  }, [bins, analyticsBinId]);

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
      const res = await fetch(`${API_URL}/api/bins/${bin.id}`, {
        headers: authHeaders(token),
      });
      const json = await res.json();
      setHistory(json.history || []);
    } catch {
      setHistory([]);
    }
  };

  const handleEditLocation = async (bin) => {
    const newLoc = window.prompt(`Update location for ${bin.name}:`, bin.location);
    if (!newLoc || newLoc.trim() === "" || newLoc === bin.location) return;

    try {
      const res = await fetch(`${API_URL}/api/bins/${bin.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ location: newLoc.trim() }),
      });
      const json = await res.json();
      if (json.status === "success") {
        // Bin state will also be updated via WebSocket broadcast
        setBins((prev) =>
          prev.map((b) => (b.id === bin.id ? { ...b, location: json.bin.location } : b))
        );
      } else {
        alert(`Failed to update location: ${json.message}`);
      }
    } catch (err) {
      alert("Error updating location");
    }
  };

  // Show nothing while checking auth session
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="pulse-ring" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <Header
        bins={bins}
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((p) => !p)}
        wsStatus={wsStatus}
        user={user}
        onLogout={logout}
      />

      <main className="main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Smart Dustbin Monitor</h1>
            <p className="page-sub">
              Real-time fill levels via ultrasonic sensors
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <ExportToExcel />
            <button className="refresh-btn" onClick={fetchBins} title="Refresh">
              ↻ Refresh
            </button>
          </div>
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
            {/* Bin Selector for Analytics */}
            <div className="bin-selector-container">
              <div className="selector-meta">
                <label className="selector-label">Analytics Target</label>
                <p className="selector-sub">
                  Switching reports for Garbage Collection & Peak Hours
                </p>
              </div>
              <select
                className="analytics-bin-select"
                value={analyticsBinId}
                onChange={(e) => setAnalyticsBinId(Number(e.target.value))}
              >
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.location}
                  </option>
                ))}
              </select>
            </div>

            <AnalyticsSection
              binId={analyticsBinId}
              refreshKey={analyticsKey}
              token={token}
              darkMode={darkMode}
            />
            <PeakHoursHeatmap
              binId={analyticsBinId}
              token={token}
              darkMode={darkMode}
            />
            <div className="bin-grid">
              {bins.map((bin) => (
                <BinCard
                  key={bin.id}
                  bin={bin}
                  onClick={() => openDetail(bin)}
                  onEditLocation={handleEditLocation}
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
