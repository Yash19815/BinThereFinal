import React, { useState, useEffect } from "react";
import {
  X,
  Sliders,
  HardDrive,
  Folder,
  ShieldCheck,
  CheckCircle2,
  Database,
  ArrowRight,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, authHeaders } from "../../utils/constants";

/**
 * AdminSettingsModal - Central administrative panel for dynamic thresholds and SQLite database hot-backups.
 */
export default function AdminSettingsModal({ isOpen, onClose, token, onConfigUpdate }) {
  const [activeTab, setActiveTab] = useState("thresholds");
  const [emptyThreshold, setEmptyThreshold] = useState(20);
  const [fullThreshold, setFullThreshold] = useState(60);
  const [backupDir, setBackupDir] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState(null);

  const isElectron = !!(window.electronAPI && window.electronAPI.selectDirectory);

  // Fetch current settings on mount
  useEffect(() => {
    if (isOpen) {
      fetchCurrentConfig();
      setBackupResult(null);
    }
  }, [isOpen]);

  const fetchCurrentConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/config/status`, {
        headers: authHeaders(token),
      });
      const data = await res.json();
      if (data.status === "success" && data.config) {
        setEmptyThreshold(data.config.EMPTY_THRESHOLD);
        setFullThreshold(data.config.FULL_THRESHOLD);
        setBackupDir(data.config.BACKUP_DIR || "");
      } else {
        toast.error("Failed to retrieve operational configuration");
      }
    } catch (err) {
      toast.error("Failed to connect to backend: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDirectory = async () => {
    if (isElectron) {
      try {
        const path = await window.electronAPI.selectDirectory();
        if (path) {
          setBackupDir(path);
          toast.success("Backup directory target updated", { icon: "📂" });
        }
      } catch (err) {
        toast.error("Failed to select directory: " + err.message);
      }
    } else {
      // Standard browser context: First attempt calling host PowerShell dialog bypass endpoint
      try {
        const res = await fetch(`${API_URL}/api/admin/select-directory`, {
          method: "GET",
          headers: {
            ...authHeaders(token),
          },
        });
        const data = await res.json();
        if (data.status === "success" && data.path) {
          setBackupDir(data.path);
          toast.success("Backup directory target updated", { icon: "📂" });
          return;
        } else if (data.status === "cancel") {
          return;
        }
      } catch (err) {
        console.warn("Backend folder picker failed, falling back to browser folder select:", err);
      }

      // Graceful fallback to sandboxed browser input
      try {
        if (window.showDirectoryPicker) {
          const handle = await window.showDirectoryPicker();
          if (handle) {
            const selectedPath = `C:/BinThere/Backups/${handle.name}`;
            setBackupDir(selectedPath);
            toast.success(`Selected folder: ${handle.name}`, { icon: "📂" });
          }
        } else {
          const input = document.createElement("input");
          input.type = "file";
          input.setAttribute("webkitdirectory", "");
          input.setAttribute("directory", "");
          input.onchange = (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              const firstFile = files[0];
              const relativePath = firstFile.webkitRelativePath || firstFile.name;
              const folderName = relativePath.split("/")[0] || "Backups";
              const selectedPath = `C:/BinThere/Backups/${folderName}`;
              setBackupDir(selectedPath);
              toast.success(`Selected folder: ${folderName}`, { icon: "📂" });
            }
          };
          input.click();
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          toast.error("Failed to select directory: " + err.message);
        }
      }
    }
  };

  const validateThresholds = () => {
    return emptyThreshold < fullThreshold;
  };

  const handleSaveConfig = async () => {
    if (!validateThresholds()) {
      toast.error("Empty limit must be strictly less than Full limit");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/config/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(token),
        },
        body: JSON.stringify({
          emptyThreshold,
          fullThreshold,
          backupDir,
        }),
      });

      const data = await res.json();
      if (data.status === "success") {
        toast.success("System configurations committed successfully! 💾");
        if (onConfigUpdate) {
          onConfigUpdate(data.config);
        }
      } else {
        toast.error(data.message || "Failed to commit settings.");
      }
    } catch (err) {
      toast.error("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      const res = await fetch(`${API_URL}/api/admin/backup`, {
        method: "POST",
        headers: authHeaders(token),
      });

      const data = await res.json();
      if (data.status === "success") {
        setBackupResult({
          file: data.backupFile,
          path: data.backupPath,
        });
        toast.success("Instant Hot-Backup completed! 🚀");
      } else {
        toast.error(data.message || "Hot-Backup execution failed.");
      }
    } catch (err) {
      toast.error("Backup interface error: " + err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop settings-backdrop" onClick={onClose}>
      <div
        className="modal-box settings-box glassmorphic-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header settings-header">
          <div className="settings-title-wrap">
            <ShieldCheck size={20} className="settings-header-icon" />
            <h2>System Control & Maintenance Panel</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="settings-tabs-row">
          <button
            className={`settings-tab-btn ${activeTab === "thresholds" ? "active" : ""}`}
            onClick={() => setActiveTab("thresholds")}
          >
            <Sliders size={16} />
            <span>Operational Thresholds</span>
          </button>
          <button
            className={`settings-tab-btn ${activeTab === "backups" ? "active" : ""}`}
            onClick={() => setActiveTab("backups")}
          >
            <HardDrive size={16} />
            <span>Database Backups</span>
          </button>
        </div>

        <div className="modal-body settings-body">
          {loading && (
            <div className="settings-loading-overlay">
              <Loader2 className="animate-spin spinner-icon" size={32} />
              <p>Syncing environment variables...</p>
            </div>
          )}

          {activeTab === "thresholds" && !loading && (
            <div className="settings-tab-content">
              <h3 className="tab-headline">Sensor Limit Calibration</h3>
              <p className="tab-desc">
                Adjust empty and full boundary variables live across physical compartments. Changes
                will trigger instant fleet capacity calculations.
              </p>

              <div className="threshold-layout">
                <div className="sliders-panel">
                  <div className="form-group threshold-slider-group">
                    <div className="slider-label-row">
                      <label className="form-label">
                        🟢 Empty Swept limit: <strong>{emptyThreshold}%</strong>
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={emptyThreshold}
                      onChange={(e) => setEmptyThreshold(Number(e.target.value))}
                      className="wizard-slider empty-slider"
                    />
                  </div>

                  <div className="form-group threshold-slider-group">
                    <div className="slider-label-row">
                      <label className="form-label">
                        🔴 Alert Full capacity: <strong>{fullThreshold}%</strong>
                      </label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={fullThreshold}
                      onChange={(e) => setFullThreshold(Number(e.target.value))}
                      className="wizard-slider full-slider"
                    />
                  </div>
                </div>

                <div className="visual-bin-wrap">
                  <div className="visual-bin">
                    <div className="visual-bin-markers">
                      <div
                        className="bin-marker full-marker"
                        style={{ bottom: `${fullThreshold}%` }}
                      >
                        <span className="marker-lbl">Full ({fullThreshold}%)</span>
                      </div>
                      <div
                        className="bin-marker empty-marker"
                        style={{ bottom: `${emptyThreshold}%` }}
                      >
                        <span className="marker-lbl">Empty ({emptyThreshold}%)</span>
                      </div>
                    </div>
                    <div
                      className="bin-liquid empty-liquid"
                      style={{ height: `${emptyThreshold}%` }}
                    />
                    <div
                      className="bin-liquid filled-liquid"
                      style={{ height: `${fullThreshold}%`, opacity: 0.15 }}
                    />
                  </div>
                </div>
              </div>

              {!validateThresholds() && (
                <div className="wizard-alert-banner">
                  <span>EMPTY boundary must be strictly lower than FULL capacity limit.</span>
                </div>
              )}

              <div className="settings-actions-footer">
                <button
                  className="modal-btn modal-btn-primary save-config-btn"
                  onClick={handleSaveConfig}
                  disabled={!validateThresholds()}
                >
                  <CheckCircle2 size={16} />
                  <span>Save Limits</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "backups" && !loading && (
            <div className="settings-tab-content">
              <h3 className="tab-headline">SQLite Hot-Backups</h3>
              <p className="tab-desc">
                Setup persistent directories and perform on-demand hot backups of your active transaction database (`bins.db`) securely.
              </p>

              <div className="form-group">
                <label className="form-label">Backups Folder Path</label>
                <div className="directory-input-row">
                  <input
                    type="text"
                    value={backupDir}
                    onChange={(e) => setBackupDir(e.target.value)}
                    placeholder="Select or enter local backups folder..."
                    className="modal-input path-input"
                  />
                  <button
                    type="button"
                    className="browse-dir-btn"
                    onClick={handleSelectDirectory}
                  >
                    <Folder size={18} />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              <div className="backup-execution-section">
                <button
                  className="modal-btn modal-btn-secondary save-backup-path-btn"
                  onClick={handleSaveConfig}
                >
                  Save Path Configuration
                </button>

                <div className="divider-line" />

                <div className="trigger-backup-row">
                  <div className="trigger-desc">
                    <strong>Trigger Immediate Hot-Backup</strong>
                    <p>Creates a point-in-time snapshot using safe multi-thread transactions.</p>
                  </div>
                  <button
                    className="instant-backup-btn"
                    onClick={handleTriggerBackup}
                    disabled={backupLoading}
                  >
                    {backupLoading ? (
                      <>
                        <Loader2 className="animate-spin text-green" size={16} />
                        <span>Backing Up...</span>
                      </>
                    ) : (
                      <>
                        <Database size={16} />
                        <span>Run Hot-Backup</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {backupResult && (
                <div className="backup-success-card animate-fadeIn">
                  <CheckCircle2 className="success-icon" size={24} />
                  <div className="success-details">
                    <h4>Snapshot Captured Successfully</h4>
                    <div className="details-grid">
                      <div className="detail-item">
                        <span>Filename:</span>
                        <code>{backupResult.file}</code>
                      </div>
                      <div className="detail-item">
                        <span>Absolute Path:</span>
                        <code>{backupResult.path}</code>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
