import React, { memo } from 'react';
import CompartmentPanel from './CompartmentPanel';
import { ALERT_THRESHOLD } from '../../utils/constants';
import { getLevel } from '../../utils/themeUtils';

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
  onDeleteBin
}) {
  const count = (dryPct !== null ? 1 : 0) + (wetPct !== null ? 1 : 0);
  const avgPct = count > 0 ? ((dryPct ?? 0) + (wetPct ?? 0)) / count : 0;
  const maxPct = Math.max(dryPct ?? 0, wetPct ?? 0);
  const isAlert = maxPct >= ALERT_THRESHOLD;

  return (
    <div className={`bin-card ${isAlert ? "bin-alert" : ""}`} onClick={() => onBinClick(binId)}>
      <div className="bin-card-header">
        <div className="bin-icon">🗑️</div>
        <div className="bin-meta">
          <h2 className="bin-name">{binName}</h2>
          <div className="location-row">
            <p className="bin-location">📍 {binLocation}</p>
            <div className="bin-actions">
              <button
                className="edit-loc-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditLocation(binId, binLocation);
                }}
                title="Edit Location"
              >
                ✏️
              </button>
              <button
                className="delete-bin-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBin(binId, binName);
                }}
                title="Delete Dustbin"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>
        {isAlert && <span className="alert-chip">⚠ Alert</span>}
      </div>

      <div className="compartments-row">
        <CompartmentPanel 
          label="🌫 Dry Waste" 
          pct={dryPct} 
          rawDistance={dryRawDistance} 
          lastUpdated={dryUpdated} 
        />
        <div className="compartment-divider" />
        <CompartmentPanel 
          label="💧 Wet Waste" 
          pct={wetPct} 
          rawDistance={wetRawDistance} 
          lastUpdated={wetUpdated} 
        />
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

export default memo(BinCard);
