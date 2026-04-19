import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { API_URL, authHeaders } from '../../utils/constants';

function linearPath(points) {
  if (points.length < 2) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

export default function AnalyticsSection({ binId, refreshKey, token }) {
  const [data, setData] = useState(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);
  const sectionRef = useRef(null);

  const handleExportImage = async () => {
    if (!sectionRef.current) return;
    try {
      const canvas = await html2canvas(sectionRef.current, { backgroundColor: '#0b1120' });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `analytics-chart-${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

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

  const W = 680,
    H = 220,
    PL = 44,
    PR = 16,
    PT = 16,
    PB = 36;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

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

  const { dryPts, wetPts, len, yTicks, xLabels, xStep } = useMemo(() => {
    const hasData = data && data.labels.length > 0;
    const len = hasData ? data.labels.length : 0;
    
    const allVals = hasData
      ? [...(data.dry || []), ...(data.wet || [])].filter((v) => v !== null)
      : [];
    const rawMax = allVals.length ? Math.max(...allVals) : 0;
    const yMax = Math.max(Math.ceil(rawMax) + 1, 5); 
    const yMin = 0;

    function toPoint(i, val) {
      const x = PL + (i / Math.max(len - 1, 1)) * chartW;
      const y = PT + chartH - ((val - yMin) / (yMax - yMin)) * chartH;
      return { x, y };
    }

    const dryPts = hasData ? (data.dry || []).map((v, i) => v !== null ? toPoint(i, v) : null) : [];
    const wetPts = hasData ? (data.wet || []).map((v, i) => v !== null ? toPoint(i, v) : null) : [];

    const yTicks = [];
    const step = yMax <= 10 ? 1 : yMax <= 20 ? 2 : 5;
    for (let v = 0; v <= yMax; v += step) yTicks.push({ v, y: PT + chartH - ((v - yMin) / (yMax - yMin)) * chartH });

    const xLabels = hasData ? data.labels : [];
    const xStep = Math.max(1, Math.ceil(xLabels.length / 8));

    return { dryPts, wetPts, len, yTicks, xLabels, xStep };
  }, [data, chartW, chartH]);

  const { dryArea, wetArea, dryLine, wetLine } = useMemo(() => {
    const dArea = areaPath(dryPts, len, data?.dry);
    const wArea = areaPath(wetPts, len, data?.wet);
    const dLine = seriesPath(dryPts);
    const wLine = seriesPath(wetPts);
    return { dryArea: dArea, wetArea: wArea, dryLine: dLine, wetLine: wLine };
  }, [dryPts, wetPts, len, data]);

  const hasData = data && data.labels.length > 0;
  const hasAnyFill = hasData && [...(data.dry || []), ...(data.wet || [])].some((v) => v > 0);

  return (
    <div className="analytics-section" ref={sectionRef}>
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Garbage Collection Analytics</h2>
          <p className="analytics-sub">Today's fill count per compartment</p>
        </div>
        <button className="refresh-btn" onClick={handleExportImage} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
          📷 Export as Image
        </button>
      </div>

      <div className="analytics-body">
        <div className="analytics-chart-panel">
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
                  let closest = 0, minDist = Infinity;
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
                    <stop offset="0%" stopColor="hsl(210, 95%, 64%)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="hsl(210, 95%, 64%)" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="grad-wet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(145, 72%, 58%)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="hsl(145, 72%, 58%)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {yTicks.map(({v, y}) => {
                  return (
                    <g key={v}>
                      <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="4 4" />
                      <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.45">{v}</text>
                    </g>
                  );
                })}

                <text x={10} y={PT + chartH / 2} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.45" transform={`rotate(-90, 10, ${PT + chartH / 2})`}>Fill Count</text>

                {xLabels.map((lbl, i) => {
                  if (i % xStep !== 0 && i !== xLabels.length - 1) return null;
                  const x = PL + (i / Math.max(len - 1, 1)) * chartW;
                  return <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.5">{lbl}</text>;
                })}

                <path d={dryArea} fill="url(#grad-dry)" />
                <path d={wetArea} fill="url(#grad-wet)" />
                <path d={dryLine} fill="none" stroke="hsl(210, 95%, 64%)" strokeWidth="2.5" strokeLinejoin="round" />
                <path d={wetLine} fill="none" stroke="hsl(145, 72%, 58%)" strokeWidth="2.5" strokeLinejoin="round" />

                {dryPts.map((pt, i) => pt && (
                  <circle key={i} cx={pt.x} cy={pt.y} r={hoveredIdx === i ? 6.5 : 4.5} fill="hsl(210, 95%, 64%)" stroke="#0b1120" strokeWidth="1.5" style={{ transition: "r 0.1s" }} />
                ))}
                {wetPts.map((pt, i) => pt && (
                  <circle key={i} cx={pt.x} cy={pt.y} r={hoveredIdx === i ? 6.5 : 4.5} fill="hsl(145, 72%, 58%)" stroke="#0b1120" strokeWidth="1.5" style={{ transition: "r 0.1s" }} />
                ))}

                {hoveredIdx !== null && (() => {
                  const dryPt = dryPts[hoveredIdx];
                  const wetPt = wetPts[hoveredIdx];
                  const anchorPt = dryPt || wetPt;
                  if (!anchorPt) return null;
                  const dryVal = data?.dry?.[hoveredIdx] ?? 0;
                  const wetVal = data?.wet?.[hoveredIdx] ?? 0;
                  const label = xLabels[hoveredIdx] ?? "";
                  const TW = 110, TH = 60, TR = 6;
                  let tx = anchorPt.x - TW / 2;
                  let ty = anchorPt.y - TH - 12;
                  if (tx < PL) tx = PL;
                  if (tx + TW > W - PR) tx = W - PR - TW;
                  if (ty < 4) ty = anchorPt.y + 14;
                  return (
                    <g style={{ pointerEvents: "none" }}>
                      <line x1={anchorPt.x} y1={PT} x2={anchorPt.x} y2={PT + chartH} stroke="currentColor" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="4 3" />
                      <rect x={tx} y={ty} width={TW} height={TH} rx={TR} ry={TR} fill="var(--surface2)" stroke="var(--border)" strokeWidth="1" style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.18))" }} />
                      <text x={tx + TW / 2} y={ty + 14} textAnchor="middle" fontSize="10" fontWeight="600" fill="currentColor" opacity="0.7">{label}</text>
                      <circle cx={tx + 16} cy={ty + 29} r="4" fill="hsl(210, 95%, 64%)" />
                      <text x={tx + 24} y={ty + 33} fontSize="10" fill="currentColor" opacity="0.8">Dry</text>
                      <text x={tx + TW - 8} y={ty + 33} textAnchor="end" fontSize="11" fontWeight="700" fill="hsl(210, 95%, 64%)">{dryVal}</text>
                      <circle cx={tx + 16} cy={ty + 47} r="4" fill="hsl(145, 72%, 58%)" />
                      <text x={tx + 24} y={ty + 51} fontSize="10" fill="currentColor" opacity="0.8">Wet</text>
                      <text x={tx + TW - 8} y={ty + 51} textAnchor="end" fontSize="11" fontWeight="700" fill="hsl(145, 72%, 58%)">{wetVal}</text>
                    </g>
                  );
                })()}
              </svg>
            )}
            {hasData && !hasAnyFill && !loading && (
              <div className="chart-nodata chart-nodata--overlay">
                <p>🗑️ No fill cycles yet in this period</p>
                <p style={{ fontSize: "0.78rem", opacity: 0.6 }}>Fill events are recorded when the bin reaches ≥ 95%</p>
              </div>
            )}
          </div>

          <div className="analytics-legend">
            <span className="legend-item dry"><span className="legend-dot" />Dry Waste</span>
            <span className="legend-item wet"><span className="legend-dot" />Wet Waste</span>
          </div>
        </div>

        <div className="analytics-stats">
          {data?.latest?.date && (
            <>
              <p className="stats-label">Latest</p>
              <p className="stats-date">{data.latest.date}</p>
            </>
          )}
          <div className="stats-item wet">
            <span className="stats-dot" style={{ background: "hsl(145, 72%, 58%)" }} />
            <span className="stats-name">Wet Waste</span>
            <span className="stats-val" style={{ color: "hsl(145, 72%, 58%)" }}>
              {data?.latest?.wet !== null && data?.latest?.wet !== undefined ? `${data.latest.wet}` : "—"}
            </span>
          </div>
          <div className="stats-item dry">
            <span className="stats-dot" style={{ background: "hsl(210, 95%, 64%)" }} />
            <span className="stats-name">Dry Waste</span>
            <span className="stats-val" style={{ color: "hsl(210, 95%, 64%)" }}>
              {data?.latest?.dry !== null && data?.latest?.dry !== undefined ? `${data.latest.dry}` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
