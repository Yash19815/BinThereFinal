import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { API_URL } from '../../utils/constants';
import { cellColor } from '../../utils/themeUtils';

const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`
);

export default function PeakHoursHeatmap({ binId, token }) {
  const [heatmap, setHeatmap] = useState(null);
  const [compartment, setCompartment] = useState("dry"); // 'dry' | 'wet'
  const [tooltip, setTooltip] = useState(null);
  const heatmapRef = useRef(null);

  const handleExportImage = async () => {
    if (!heatmapRef.current) return;
    try {
      const canvas = await html2canvas(heatmapRef.current, { backgroundColor: '#0b1120' });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `heatmap-export-${Date.now()}.png`;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
    }
  };

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
    <div className="analytics-section" style={{ marginTop: "24px" }} ref={heatmapRef}>
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Peak Fill Hours</h2>
          <p className="analytics-sub">Average fill cycles by time of day</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="refresh-btn" onClick={handleExportImage} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
            📷 Export as Image
          </button>
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
      </div>
      <div className="analytics-body" style={{ padding: "0 24px 24px 24px" }}>
        <div className="heatmap-wrapper">
          <div className="heatmap-meta" style={{ marginBottom: "12px", fontSize: "14px", color: "var(--text3)" }}>
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
                    style={{ backgroundColor: cellColor(value, max, compartment) }}
                    onMouseEnter={(e) => {
                      const rect = e.target.getBoundingClientRect();
                      setTooltip({
                        day:   DAYS[dayIdx],
                        hour:  HOURS[hourIdx],
                        value,
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
                ? `linear-gradient(to right, ${cellColor(0, max, "dry")}, ${cellColor(max || 1, max || 1, "dry")})`
                : `linear-gradient(to right, ${cellColor(0, max, "wet")}, ${cellColor(max || 1, max || 1, "wet")})`
            }} />
            <span>{(max || 0).toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
