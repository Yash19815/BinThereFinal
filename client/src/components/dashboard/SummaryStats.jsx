import React, { useEffect, useState } from 'react';
import { API_URL, authHeaders } from '../../utils/constants';

/**
 * Displays the 24h Bin Utilization Score.
 */
export default function SummaryStats({ token, refreshKey }) {
  const [score, setScore] = useState(null);

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/analytics/utilization`, { headers: authHeaders(token) })
      .then(res => res.json())
      .then(data => {
        if (active && data.status === "success") {
          setScore(data.utilization_score);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [token, refreshKey]);

  let statusColor = "var(--text3)";
  let statusClass = "unknown";
  if (score !== null) {
    if (score <= 40) { statusColor = "var(--c-low)"; statusClass = "low"; }
    else if (score <= 70) { statusColor = "var(--c-high)"; statusClass = "high"; }
    else { statusColor = "var(--c-full)"; statusClass = "full"; }
  }

  // Circular progress math
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = score !== null 
    ? circumference - (score / 100) * circumference
    : circumference;

  return (
    <div className={`summary-stat-card ${statusClass}`}>
      <div className="stat-info">
        <h3 className="stat-title">Utilization Score</h3>
        <p className="stat-label">Avg fill level (24h)</p>
        <div className="stat-value-text" style={{ color: statusColor }}>
          {score !== null ? `${score}%` : "—"}
        </div>
      </div>
      <div className="stat-circle-wrap">
        <svg width="84" height="84" className="stat-circle" viewBox="0 0 84 84">
          <circle 
            cx="42" cy="42" r={radius} 
            className="stat-circle-bg" 
          />
          <circle 
            cx="42" cy="42" r={radius} 
            className="stat-circle-fg"
            style={{ 
              stroke: statusColor,
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset
            }} 
          />
        </svg>
      </div>
    </div>
  );
}
