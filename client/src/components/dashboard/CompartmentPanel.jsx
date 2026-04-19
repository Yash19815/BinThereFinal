import React from 'react';
import { getLevel, getStatusLabel } from '../../utils/themeUtils';
import { timeAgo } from '../../utils/formatters';

export default function CompartmentPanel({ label, pct, rawDistance, lastUpdated }) {
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
            {rawDistance !== undefined
              ? `${rawDistance} cm`
              : ""}
          </span>
        </div>
      </div>

      <div className="comp-footer">
        <span className="last-updated-label">Updated</span>
        <span className="last-updated-val">{timeAgo(lastUpdated)}</span>
      </div>
    </div>
  );
}
