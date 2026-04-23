import React, { useEffect } from "react";
import { X, Info, AlertTriangle } from "lucide-react";

/**
 * A premium glassmorphic modal for displaying messages or alerts.
 * Designed to align with the "Frosted Control Room" aesthetic.
 */
const MessageModal = ({
  isOpen,
  onClose,
  title = "Notification",
  message,
  type = "info", // "info" | "warning" | "error"
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "warning":
        return <AlertTriangle size={28} className="modal-icon warning" style={{ color: "#fbbf24" }} />;
      case "error":
        return <AlertTriangle size={28} className="modal-icon error" style={{ color: "#f87171" }} />;
      default:
        return <Info size={28} className="modal-icon info" style={{ color: "#3b82f6" }} />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 2000 }}>
      <div
        className="modal-box message-modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "400px",
          width: "90%",
          transform: "translateY(0)",
          animation: "modalFadeIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {getIcon()}
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: "24px", lineHeight: "1.6" }}>
          <p style={{ margin: 0, color: "var(--text2)", fontSize: "1rem" }}>{message}</p>
        </div>

        <div className="modal-footer" style={{ padding: "16px 24px" }}>
          <button 
            className="modal-btn modal-btn-primary" 
            onClick={onClose} 
            autoFocus
            style={{ width: "100%", padding: "10px" }}
          >
            Got it
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .message-modal-box {
          border-radius: 16px;
          overflow: hidden;
        }
      `}} />
    </div>
  );
};

export default MessageModal;
