import React, { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";

/**
 * ExportToExcel Component
 *
 * Add this component to your dashboard wherever you want the export button
 * Example usage:
 *
 * import ExportToExcel from './components/ExportToExcel';
 *
 * function Dashboard() {
 *   return (
 *     <div>
 *       <ExportToExcel />
 *       {/* rest of your dashboard *\/}
 *     </div>
 *   );
 * }
 */

const ExportToExcel = ({ apiBaseUrl = "http://localhost:3001/api" }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // 'success', 'error', null
  const toYmd = (d) => d.toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(() =>
    toYmd(new Date(Date.now() - 6 * 86400000)),
  );
  const [toDate, setToDate] = useState(() => toYmd(new Date()));
  const [formError, setFormError] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(null);
    setFormError(null);

    try {
      if (fromDate && toDate && fromDate > toDate) {
        throw new Error("Invalid date range");
      }

      const qs = new URLSearchParams();
      if (fromDate) qs.set("from", fromDate);
      if (toDate) qs.set("to", toDate);

      const response = await fetch(
        `${apiBaseUrl}/export/excel?${qs.toString()}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `binthere_export_${new Date().toISOString().split("T")[0]}.xlsx`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      setTimeout(() => setExportStatus(null), 3000);
    } catch (error) {
      console.error("Export error:", error);
      if (error?.message === "Invalid date range") {
        setFormError("From date must be earlier than or equal to To date.");
      }
      setExportStatus("error");
      setTimeout(() => setExportStatus(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-container">
      <div className="date-range">
        <label className="date-label">
          <span className="date-label-text">From</span>
          <input
            className="date-input"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            disabled={isExporting}
          />
        </label>
        <span className="date-separator">→</span>
        <label className="date-label">
          <span className="date-label-text">To</span>
          <input
            className="date-input"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            disabled={isExporting}
          />
        </label>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`export-button ${isExporting ? "exporting" : ""} ${exportStatus || ""}`}
        title="Export selected date range to Excel"
      >
        {isExporting ? (
          <>
            <Loader2 className="icon spin" size={16} />
            <span>Exporting...</span>
          </>
        ) : exportStatus === "success" ? (
          <>
            <CheckCircle className="icon" size={16} />
            <span>Exported!</span>
          </>
        ) : exportStatus === "error" ? (
          <>
            <XCircle className="icon" size={16} />
            <span>Failed</span>
          </>
        ) : (
          <>
            <FileSpreadsheet className="icon" size={16} />
            <span>Export</span>
          </>
        )}
      </button>

      {exportStatus === "error" && (
        <div className="error-message">
          {formError ? formError : "Failed to export data."}
        </div>
      )}

      <style jsx="true">{`
        .export-container {
          display: flex;
          align-items: center;
          gap: 12px;
          position: relative;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          padding: 6px 12px;
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-sm);
          box-shadow: var(--glass-shadow);
        }

        .date-range {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .date-separator {
          color: var(--text3);
          font-weight: 500;
          font-size: 0.85rem;
          margin-top: 14px;
        }

        .date-label {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .date-label-text {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text2);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .date-input {
          appearance: none;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid var(--glass-border);
          color: var(--text);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 0.85rem;
          font-weight: 500;
          font-family: inherit;
          transition: all 0.2s ease;
        }
        
        .date-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }

        .date-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .export-button {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          margin-top: 18px; /* align with inputs that have labels */
          background: #10b981; /* Premium green for Excel */
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          font-family: inherit;
          box-shadow: 0 2px 6px rgba(16, 185, 129, 0.25);
        }

        .export-button:hover:not(:disabled) {
          background: #059669;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .export-button:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 1px 3px rgba(16, 185, 129, 0.2);
        }

        .export-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          background: var(--text3);
          box-shadow: none;
        }

        .export-button.success {
          background: #3b82f6;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
        }

        .export-button.error {
          background: #ef4444;
          box-shadow: 0 2px 6px rgba(239, 68, 68, 0.25);
        }

        .icon {
          flex-shrink: 0;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-message {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: var(--surface);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 500;
          white-space: nowrap;
          box-shadow: var(--shadow-lg);
          animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 10;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default ExportToExcel;
