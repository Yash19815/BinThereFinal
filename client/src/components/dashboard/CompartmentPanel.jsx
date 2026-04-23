import React from "react";
import { Droplets, Wind, Clock } from "lucide-react";
import { getLevel, getStatusLabel } from "../../utils/themeUtils";
import { timeAgo } from "../../utils/formatters";

export default function CompartmentPanel({
  label,
  pct,
  rawDistance,
  lastUpdated,
  type,
}) {
  const level = getLevel(pct);
  const Icon = type === "wet" ? Droplets : Wind;

  return (
    <div className={`compartment-panel ${level}`}>
      <div className="comp-header">
        <div className="comp-label-group">
          <Icon size={12} className="comp-type-icon" />
          <span className="comp-label">{label}</span>
        </div>
        <span className={`status-pill ${level}`}>{getStatusLabel(pct)}</span>
      </div>

      <div className="fill-visual">
        <div className="fill-tube-v2">
          <div
            className={`fill-liquid-v2 ${level} ${type}`}
            style={{ height: `${pct ?? 0}%` }}
          />
          <div className="glass-shimmer" />
        </div>
        <div className="fill-pct-label">
          <span className="big-pct">
            {pct !== null ? `${pct.toFixed(0)}%` : "—"}
          </span>
          <span className="dist-label">
            {rawDistance !== undefined ? `${rawDistance} cm` : ""}
          </span>
        </div>
      </div>

      <div className="comp-footer">
        <Clock size={10} />
        <span className="last-updated-val">{timeAgo(lastUpdated)}</span>
      </div>
    </div>
  );
}
