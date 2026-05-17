import React, { useState } from "react";
import {
  X,
  ArrowRight,
  ArrowLeft,
  Folder,
  Sliders,
  HardDrive,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { API_URL, authHeaders } from "../../utils/constants";

/**
 * SetupWizard Component - Glassmorphic first-run guide for BinThere administration.
 * Enables setting operational fill level limits and configuring hot backup options.
 */
export default function SetupWizard({ isOpen, token, onComplete, onClose }) {
  const [step, setStep] = useState(1);
  const [emptyThreshold, setEmptyThreshold] = useState(20);
  const [fullThreshold, setFullThreshold] = useState(60);
  const [backupDir, setBackupDir] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isElectron = !!(window.electronAPI && window.electronAPI.selectDirectory);

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

  const handleNext = () => {
    if (step === 2 && !validateThresholds()) {
      toast.error("Empty limit must be strictly less than Full limit");
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
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
        localStorage.setItem("bt_setup_completed", "true");
        toast.success("Initial server environment loaded successfully! 🚀");
        onComplete(data.config);
      } else {
        toast.error(data.message || "Failed to commit system config.");
      }
    } catch (err) {
      toast.error("Network interface disconnected: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop wizard-backdrop">
      <div className="modal-box wizard-box glassmorphic-panel">
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        <div className="modal-header wizard-header">
          <div className="wizard-title-wrap">
            <span className="wizard-step-tag">Step {step} of 4</span>
            <h2>System Initialization Wizard</h2>
          </div>
          {onClose && (
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="modal-body wizard-body">
          {step === 1 && (
            <div className="wizard-step wizard-step-welcome">
              <div className="wizard-icon-hero">🗑️</div>
              <h3 className="wizard-headline">Welcome to BinThere Waste Intelligence</h3>
              <p className="wizard-desc">
                Let's configure your system thresholds and dynamic persistent backup settings
                to initialize your smart dashboard correctly. This setup sets baseline parameters
                across physical sensor fleets.
              </p>
              <div className="wizard-feature-list">
                <div className="wizard-feature-item">
                  <div className="feat-bullet">✓</div>
                  <div>
                    <strong>Fill Cycle Optimization:</strong> Distinguish between full bins and collection sweeps.
                  </div>
                </div>
                <div className="wizard-feature-item">
                  <div className="feat-bullet">✓</div>
                  <div>
                    <strong>On-Demand Snapshots:</strong> Trigger lightweight SQLite hot-backups dynamically.
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step wizard-step-thresholds">
              <h3 className="wizard-headline">Configure Compartment Thresholds</h3>
              <p className="wizard-desc">
                Specify operational percentage boundaries for alert logs and dashboard color indexes.
              </p>

              <div className="wizard-threshold-layout">
                <div className="wizard-sliders-panel">
                  <div className="form-group threshold-slider-group">
                    <div className="slider-label-row">
                      <label className="form-label">
                        🟢 Empty Swept Boundary (Min: {emptyThreshold}%)
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
                    <span className="slider-hint">
                      Percentage limit below which a dustbin is cataloged as officially emptied.
                    </span>
                  </div>

                  <div className="form-group threshold-slider-group">
                    <div className="slider-label-row">
                      <label className="form-label">
                        🔴 Alert Full Capacity (Max: {fullThreshold}%)
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
                    <span className="slider-hint">
                      Capacity limit at or above which an alert or sweep notification is dispatched.
                    </span>
                  </div>
                </div>

                {/* Interactive Dynamic Preview Bin */}
                <div className="wizard-visual-bin-wrap">
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
                      style={{
                        height: `${fullThreshold}%`,
                        opacity: 0.15,
                      }}
                    />
                  </div>
                </div>
              </div>

              {!validateThresholds() && (
                <div className="wizard-alert-banner">
                  <ShieldAlert size={16} />
                  <span>EMPTY limit must be lower than FULL capacity limit.</span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step wizard-step-backups">
              <h3 className="wizard-headline">Configure Persistence & Backup Path</h3>
              <p className="wizard-desc">
                Setup a destination directory on the host machine for active hot backups.
              </p>

              <div className="form-group">
                <label className="form-label">Hot-Backup Output Location</label>
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
                    title="Select Directory"
                  >
                    <Folder size={18} />
                    <span>Browse...</span>
                  </button>
                </div>
                <span className="slider-hint">
                  Specify the absolute path where SQLite point-in-time backup snapshots will be persisted.
                </span>
              </div>

              <div className="backup-explanation-card">
                <HardDrive size={18} />
                <div className="explanation-text">
                  <strong>SQLite Hot-Backup Utility:</strong> BinThere copies standard transaction logs
                  dynamically without blocking active database writes, ensuring complete historical
                  persistence.
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-step wizard-step-confirmation">
              <div className="wizard-icon-hero confirmation-icon">⚡</div>
              <h3 className="wizard-headline">Ready for Deployment!</h3>
              <p className="wizard-desc">
                Double check these baseline configuration targets before saving the server's environment.
              </p>

              <div className="wizard-summary-card">
                <div className="summary-row">
                  <span className="summary-lbl">🟢 Swept Low Boundary</span>
                  <strong className="summary-val">{emptyThreshold}%</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-lbl">🔴 Full Alert Level</span>
                  <strong className="summary-val">{fullThreshold}%</strong>
                </div>
                <div className="summary-row">
                  <span className="summary-lbl">📂 Backup Output Path</span>
                  <strong className="summary-val path-val">
                    {backupDir.trim() || "Default directory (server/backups)"}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer wizard-footer">
          {step > 1 && (
            <button
              className="modal-btn modal-btn-secondary back-btn"
              onClick={handleBack}
              disabled={loading}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          )}

          {step < 4 ? (
            <button
              className="modal-btn modal-btn-primary next-btn"
              onClick={handleNext}
            >
              <span>Continue</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="modal-btn modal-btn-primary deploy-btn"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <div className="wizard-spinner" />
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Apply Settings</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
