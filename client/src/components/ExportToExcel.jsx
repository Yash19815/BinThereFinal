import React, { useState, useEffect } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Info,
} from "lucide-react";
import MessageModal from "./modals/MessageModal";
import CalendarPicker from "./common/CalendarPicker";

/**
 * A premium Excel export component with glassmorphic UI and smart date constraints.
 * Features:
 * - Integration with /api/export/metadata for earliest data point.
 * - Custom premium CalendarPicker for date selection.
 * - Validation for earliest date and 365-day range limit.
 * - Frosted Control Room aesthetic matching the rest of the dashboard.
 */
const ExportToExcel = ({ apiBaseUrl = "http://localhost:3001/api" }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // 'success', 'error', null
  const [successInfo, setSuccessInfo] = useState(null);
  
  const [earliestDate, setEarliestDate] = useState(null);
  const [modalState, setModalState] = useState({ isOpen: false, title: "", message: "", type: "info" });

  const toYmd = (d) => d.toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(() =>
    toYmd(new Date(Date.now() - 6 * 86400000)),
  );
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/export/metadata`);
        const data = await res.json();
        if (data.status === "success" && data.earliestDate) {
          setEarliestDate(data.earliestDate.split("T")[0]);
        }
      } catch (err) {
        console.error("Metadata fetch error:", err);
      }
    };
    fetchMetadata();
  }, [apiBaseUrl]);

  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    if (days > 0) start.setDate(start.getDate() - days);
    let startYmd = toYmd(start);
    if (earliestDate && startYmd < earliestDate) startYmd = earliestDate;
    setFromDate(startYmd);
    setToDate(toYmd(end));
    setFormError(null);
  };

  const handleExport = async () => {
    if (fromDate && toDate && fromDate > toDate) {
      setModalState({
        isOpen: true,
        title: "Invalid Range",
        message: "The start date cannot be after the end date.",
        type: "warning"
      });
      return;
    }

    if (earliestDate && fromDate < earliestDate) {
      setModalState({
        isOpen: true,
        title: "Range Violation",
        message: `Our database records begin on ${new Date(earliestDate).toLocaleDateString()}.`,
        type: "error"
      });
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 365) {
      setModalState({
        isOpen: true,
        title: "Limit Exceeded",
        message: "Maximum export range is 365 days.",
        type: "warning"
      });
      return;
    }

    setIsExporting(true);
    setExportStatus(null);
    setFormError(null);
    setSuccessInfo(null);

    try {
      const qs = new URLSearchParams();
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);

      const response = await fetch(
        `${apiBaseUrl}/export/excel?${qs.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        },
      );

      if (!response.ok) throw new Error(`Export failed`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `binthere_report_${toDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      setSuccessInfo(`Export Complete`);
      setTimeout(() => {
        setExportStatus(null);
        setSuccessInfo(null);
      }, 6000);
    } catch (error) {
      setExportStatus("error");
      setFormError("Export Failed");
      setTimeout(() => setExportStatus(null), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="sidebar-export-tool glass-card">
      <div className="card-header-row">
        <div className="card-identity">
          <div className="card-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <FileSpreadsheet className="icon-emerald" size={18} />
          </div>
          <div>
            <h3 className="card-title">Intelligence Export</h3>
            <p className="card-subtitle">Generate XLSX audit logs</p>
          </div>
        </div>
      </div>

      <div className="export-sidebar-body">
        <div className="sidebar-presets">
          <button onClick={() => applyPreset(0)} className="side-preset">Today</button>
          <button onClick={() => applyPreset(7)} className="side-preset">7 Days</button>
          <button onClick={() => applyPreset(30)} className="side-preset">30 Days</button>
        </div>

        <div className="sidebar-pickers">
          <CalendarPicker 
            label="START DATE"
            value={fromDate} 
            onChange={setFromDate}
            minDate={earliestDate}
            maxDate={toDate}
          />
          <div className="sidebar-connector" />
          <CalendarPicker 
            label="END DATE"
            value={toDate} 
            onChange={setToDate}
            minDate={fromDate}
            maxDate={toYmd(new Date())}
          />
        </div>

        <div className="sidebar-meta">
          {earliestDate ? (
             <div className="meta-chip">
               <Info size={12} opacity={0.6} />
               <span>Archive starts {new Date(earliestDate).toLocaleDateString()}</span>
             </div>
          ) : (
            <div className="meta-chip loading">
              <Loader2 className="animate-spin" size={12} />
              <span>Checking archive...</span>
            </div>
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting}
          className={`sidebar-generate-btn ${isExporting ? "loading" : ""} ${exportStatus || ""}`}
        >
          {isExporting ? (
            <Loader2 className="animate-spin" size={18} />
          ) : exportStatus === "success" ? (
            <CheckCircle size={18} />
          ) : exportStatus === "error" ? (
            <XCircle size={18} />
          ) : (
            <Download size={18} />
          )}
          <span>{isExporting ? "Processing..." : exportStatus === "success" ? "Downloaded" : "Generate Report"}</span>
        </button>

        {formError && <div className="sidebar-error-msg">{formError}</div>}
      </div>

      <MessageModal 
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />

      <style jsx="true">{`
        .sidebar-export-tool {
          background: var(--glass-bg-strong);
          backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
        }
        .card-header-row { display: flex; align-items: center; }
        .card-identity { display: flex; align-items: center; gap: 12px; }
        .card-icon-wrap { padding: 8px; border-radius: 10px; display: flex; }
        .icon-emerald { color: #10b981; }
        .card-title { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--text); }
        .card-subtitle { margin: 0; font-size: 0.75rem; color: var(--text3); }
        .sidebar-presets { display: flex; gap: 8px; }
        .side-preset {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 0.7rem;
          color: var(--text2);
          cursor: pointer;
        }
        .sidebar-pickers { display: flex; flex-direction: column; gap: 10px; }
        .sidebar-connector { height: 10px; width: 1px; background: rgba(255,255,255,0.1); margin: 0 auto; }
        .meta-chip { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: var(--text3); padding: 8px; }
        .sidebar-generate-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          background: #10b981; color: white; border: none; border-radius: 12px;
          padding: 12px; font-weight: 600; cursor: pointer; transition: 0.2s;
        }
        .sidebar-generate-btn:hover { opacity: 0.9; }
        .sidebar-error-msg { color: #ef4444; font-size: 0.75rem; text-align: center; margin-top: 8px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ExportToExcel;

