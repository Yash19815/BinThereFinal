import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { API_URL, authHeaders } from "../../utils/constants";
import { TrendingUp, Info } from "lucide-react";

function smoothPath(points, minY, maxY) {
  if (points.length < 2) return "";
  const k = 0.2; // smoothing factor
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * k;
    const cp1y = Math.max(minY, Math.min(maxY, p1.y + (p2.y - p0.y) * k));
    const cp2x = p2.x - (p3.x - p1.x) * k;
    const cp2y = Math.max(minY, Math.min(maxY, p2.y - (p3.y - p1.y) * k));

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export default function FleetUtilizationChart({ token, refreshKey }) {
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const svgRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreRes, historyRes] = await Promise.all([
        fetch(`${API_URL}/api/analytics/utilization`, { headers: authHeaders(token) }),
        fetch(`${API_URL}/api/analytics/fleet-history`, { headers: authHeaders(token) })
      ]);
      
      const scoreJson = await scoreRes.json();
      const historyJson = await historyRes.json();

      if (scoreJson.status === "success") setScore(scoreJson.utilization_score);
      if (historyJson.status === "success") setHistory(historyJson);
    } catch (err) {
      console.error("Failed to fetch fleet analytics:", err);
    } finally {
      setLoading(false);
    }
  }, [token, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Chart dimensions
  const W = 400, H = 120, PL = 30, PR = 10, PT = 10, PB = 20;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const { points, yTicks, xLabels } = useMemo(() => {
    const hasData = history && history.points.length > 0;
    const len = hasData ? history.points.length : 0;
    const rawMax = hasData ? Math.max(...history.points) : 0;
    const yMax = Math.max(Math.ceil(rawMax / 10) * 10 + 10, 50);
    const yMin = 0;

    const points = hasData 
      ? history.points.map((val, i) => ({
          x: PL + (i / Math.max(len - 1, 1)) * chartW,
          y: PT + chartH - ((val - yMin) / (yMax - yMin)) * chartH,
          val
        }))
      : [];

    const yTicks = [0, yMax / 2, yMax].map(v => ({
      v,
      y: PT + chartH - ((v - yMin) / (yMax - yMin)) * chartH
    }));

    const xLabels = hasData ? history.labels : [];

    return { points, yTicks, xLabels };
  }, [history, chartW, chartH]);

  const pathD = useMemo(() => smoothPath(points, PT, PT + chartH), [points, PT, chartH]);
  const areaD = useMemo(() => {
    if (points.length < 2) return "";
    return `${pathD} L ${points[points.length-1].x} ${PT + chartH} L ${points[0].x} ${PT + chartH} Z`;
  }, [pathD, points, chartH]);

  const getStatusColor = (val) => {
    if (val === null) return "var(--text3)";
    if (val <= 40) return "#10b981"; // Emerald
    if (val <= 70) return "#f59e0b"; // Amber
    return "#ef4444"; // Red
  };

  const statusColor = getStatusColor(score);
  
  // Circular progress
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = score !== null ? circumference - (score / 100) * circumference : circumference;

  return (
    <div className="fleet-chart-card glass-card">
        <div className="card-header-row">
          <div className="card-identity">
            <div className="card-icon-wrap">
              <TrendingUp size={18} className="icon-primary" />
            </div>
            <div>
              <h3 className="card-title">Fleet Utilization</h3>
              <p className="card-subtitle">Real-time aggregate fill levels</p>
            </div>
          </div>
          
          <div className="score-summary-compact">
            <div className="circular-progress-wrap">
              <svg width="64" height="64" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r={radius} className="stat-circle-bg" strokeWidth="8" />
                <circle
                  cx="42" cy="42" r={radius}
                  className="stat-circle-fg"
                  strokeWidth="8"
                  style={{
                    stroke: statusColor,
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                  }}
                />
              </svg>
              <div className="score-text-compact">
                <span className="score-num-compact">{score !== null ? score : "—"}</span>
                <span className="score-unit-compact">%</span>
              </div>
            </div>
            <div className="score-label-wrap-compact">
              <span className="score-status-compact" style={{ color: statusColor }}>
                {score <= 40 ? "Optimal" : score <= 70 ? "Moderate" : "Critical"}
              </span>
            </div>
          </div>
        </div>

        <div className="chart-fill-area">
          <div className="history-chart-wrap">
          <svg 
            viewBox={`0 0 ${W} ${H}`} 
            className="history-svg"
            onMouseMove={(e) => {
              if (!history) return;
              const svg = e.currentTarget;
              const rect = svg.getBoundingClientRect();
              const scaleX = W / rect.width;
              const mouseX = (e.clientX - rect.left) * scaleX;
              let closest = 0, minDist = Infinity;
              points.forEach((pt, i) => {
                const dist = Math.abs(pt.x - mouseX);
                if (dist < minDist) {
                  minDist = dist;
                  closest = i;
                }
              });
              setHoveredIdx(closest);
            }}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="fleet-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={statusColor} stopOpacity="0.3" />
                <stop offset="100%" stopColor={statusColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y Ticks */}
            {yTicks.map(t => (
              <g key={t.v}>
                <line x1={PL} y1={t.y} x2={W-PR} y2={t.y} stroke="currentColor" strokeOpacity="0.05" strokeDasharray="4 4" />
                <text x={PL-5} y={t.y+4} textAnchor="end" fontSize="9" fill="currentColor" opacity="0.3">{t.v}%</text>
              </g>
            ))}

            {/* X Labels */}
            {xLabels.map((lbl, i) => (
              <text key={i} x={points[i].x} y={H-2} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.3">
                {lbl.split(' ')[0]}
              </text>
            ))}

            <path d={areaD} fill="url(#fleet-grad)" />
            <path d={pathD} fill="none" stroke={statusColor} strokeWidth="2.5" strokeLinecap="round" />

            {points.map((pt, i) => (
              <circle 
                key={i} 
                cx={pt.x} cy={pt.y} 
                r={hoveredIdx === i ? 4 : 2} 
                fill={statusColor} 
                stroke="var(--glass-bg-strong)" 
                strokeWidth="1"
                style={{ transition: 'r 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
              />
            ))}

            {hoveredIdx !== null && (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={points[hoveredIdx].x} y1={PT} x2={points[hoveredIdx].x} y2={PT+chartH} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 2" />
                <rect 
                  x={points[hoveredIdx].x - 20} y={points[hoveredIdx].y - 25} 
                  width="40" height="20" rx="4" 
                  fill="var(--glass-bg-strong)" stroke="var(--glass-border)" strokeWidth="0.5" 
                />
                <text x={points[hoveredIdx].x} y={points[hoveredIdx].y - 11} textAnchor="middle" fontSize="10" fontWeight="bold" fill="white">
                  {points[hoveredIdx].val}%
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
}
