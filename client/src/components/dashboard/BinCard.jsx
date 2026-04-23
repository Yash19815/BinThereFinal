import React, { memo } from "react";
import { Trash2, MapPin, Edit3, AlertTriangle, Box } from "lucide-react";
import CompartmentPanel from "./CompartmentPanel";
import { ALERT_THRESHOLD } from "../../utils/constants";
import { getLevel } from "../../utils/themeUtils";

function BinCard({
  binId,
  binName,
  binLocation,
  dryPct,
  wetPct,
  dryRawDistance,
  wetRawDistance,
  dryUpdated,
  wetUpdated,
  onBinClick,
  onEditLocation,
  onDeleteBin,
}) {
  const count = (dryPct !== null ? 1 : 0) + (wetPct !== null ? 1 : 0);
  const avgPct = count > 0 ? ((dryPct ?? 0) + (wetPct ?? 0)) / count : 0;
  const maxPct = Math.max(dryPct ?? 0, wetPct ?? 0);
  const isAlert = maxPct >= ALERT_THRESHOLD;

  return (
    <div
      className={`bin-card ${isAlert ? "bin-alert" : ""}`}
      onClick={() => onBinClick(binId)}
    >
      {isAlert && (
        <div className="alert-indicator">
          <AlertTriangle size={18} />
        </div>
      )}

      <div className="bin-card-header">
        <div className="bin-icon-v2">
          <Box size={20} />
        </div>
        <div className="bin-meta">
          <h2 className="bin-name">{binName}</h2>
          <div className="location-row">
            <p className="bin-location">
              <MapPin size={12} />
              {binLocation}
            </p>
            <div className="bin-actions">
              <button
                className="action-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLocation(binId, binLocation);
                }}
                title="Edit Location"
              >
                <Edit3 size={14} />
              </button>
              <button
                className="action-icon-btn delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBin(binId, binName);
                }}
                title="Delete Dustbin"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="compartments-row">
        <CompartmentPanel
          label="Dry Waste"
          pct={dryPct}
          rawDistance={dryRawDistance}
          lastUpdated={dryUpdated}
          type="dry"
        />
        <CompartmentPanel
          label="Wet Waste"
          pct={wetPct}
          rawDistance={wetRawDistance}
          lastUpdated={wetUpdated}
          type="wet"
        />
      </div>

      <div className="bin-card-footer">
        <span className="overall-label">Average Fill</span>
        <div className="overall-bar-wrap-v2">
          <div
            className={`overall-bar-v2 ${getLevel(avgPct)}`}
            style={{ width: `${avgPct}%` }}
          />
        </div>
        <span className="overall-pct">{avgPct.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default memo(BinCard);
