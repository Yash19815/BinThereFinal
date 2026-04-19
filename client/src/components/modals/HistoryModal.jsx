import React from 'react';
import HistoryChart from './HistoryChart';
import { formatDate, formatTime } from '../../utils/formatters';
import { getLevel, getStatusLabel } from '../../utils/themeUtils';

/**
 * Full-screen overlay modal showing a bin's measurement history.
 */
export default function HistoryModal({ bin, history, onClose }) {
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
