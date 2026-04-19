import React from 'react';

/**
 * Small SVG area chart used inside HistoryModal for per-compartment history.
 */
export default function HistoryChart({ label, entries, color }) {
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
