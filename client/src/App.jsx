import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import { useAuth } from "./AuthContext.jsx";
import LoginPage from "./LoginPage.jsx";
import ExportToExcel from "./components/ExportToExcel";

import Header from "./components/layout/Header";
import SummaryStats from "./components/dashboard/SummaryStats";
import AnalyticsSection from "./components/dashboard/AnalyticsSection";
import PeakHoursHeatmap from "./components/dashboard/PeakHoursHeatmap";
import BinCard from "./components/dashboard/BinCard";
import HistoryModal from "./components/modals/HistoryModal";

import EmptyState from "./components/ui/EmptyState";
import InlineError from "./components/ui/InlineError";
import { BinCardSkeleton } from "./components/ui/Skeleton";

import { useBins } from "./hooks/useBins";
import { API_URL, authHeaders } from "./utils/constants";

export default function App() {
  const { user, token, logout, loading: authLoading } = useAuth();
  
  const {
    bins,
    loading: binsLoading,
    error,
    wsStatus,
    analyticsKey,
    analyticsBinId,
    setAnalyticsBinId,
    refreshBins,
    addBin,
    updateBinLocation,
    deleteBin,
  } = useBins(token);

  const [history, setHistory] = useState([]);
  const [selectedBinId, setSelectedBinId] = useState(null);

  const openDetail = useCallback(async (binId) => {
    setSelectedBinId(binId);
    try {
      const res = await fetch(`${API_URL}/api/bins/${binId}`, {
        headers: authHeaders(token),
      });
      const json = await res.json();
      setHistory(json.history || []);
    } catch {
      setHistory([]);
    }
  }, [token]);

  const handleEditLocation = useCallback(async (binId, currLocation) => {
    const newLoc = window.prompt(`Update location:`, currLocation);
    if (!newLoc || newLoc.trim() === "" || newLoc === currLocation) return;
    try {
      await updateBinLocation(binId, newLoc.trim());
    } catch (err) {
      alert(`Error updating location: ${err.message}`);
    }
  }, [updateBinLocation]);

  const handleAddBin = useCallback(async () => {
    const name = window.prompt("Enter Dustbin Name:");
    if (!name) return;
    const location = window.prompt("Enter Location:");
    if (!location) return;

    try {
      await addBin(name.trim(), location.trim());
    } catch (err) {
      alert(`Error creating bin: ${err.message}`);
    }
  }, [addBin]);

  const handleDeleteBin = useCallback(async (binId, binName) => {
    if (!window.confirm(`Are you sure you want to delete "${binName}"?\nThis will erase ALL its history permanently.`)) return;

    try {
      await deleteBin(binId);
    } catch (err) {
      alert(`Error deleting bin: ${err.message}`);
    }
  }, [deleteBin]);

  // Show nothing while checking auth session
  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="pulse-ring" />
      </div>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return <LoginPage />;
  }

  const selectedBin = bins.find(b => b.id === selectedBinId);

  return (
    <div className="app">
      <Header
        bins={bins}
        wsStatus={wsStatus}
        user={user}
        onLogout={logout}
      />

      <main className="main">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">Smart Dustbin Monitor</h1>
            <p className="page-sub">
              Real-time fill levels via ultrasonic sensors
            </p>
          </div>
          <div className="page-title-actions">
            <button className="add-bin-btn" onClick={handleAddBin}>
              ➕ Add Dustbin
            </button>
            <ExportToExcel />
            <button className="refresh-btn" onClick={refreshBins} title="Refresh">
              ↻ Refresh
            </button>
          </div>
        </div>

        <div className="summary-stats">
          <SummaryStats token={token} refreshKey={analyticsKey} />
        </div>

        {binsLoading && bins.length === 0 ? (
          <div className="bin-grid">
            <BinCardSkeleton />
            <BinCardSkeleton />
            <BinCardSkeleton />
          </div>
        ) : error ? (
          <InlineError message={error} onRetry={refreshBins} />
        ) : bins.length === 0 ? (
          <EmptyState
            icon="🗑️"
            title="No Bins Found"
            description="Waiting for sensor data. Make sure the backend is running and the ESP32 is sending data."
          >
            <button className="add-bin-btn" onClick={handleAddBin}>➕ Add Dustbin</button>
          </EmptyState>
        ) : (
          <>
            {/* Bin Selector for Analytics */}
            <div className="bin-selector-container">
              <div className="selector-meta">
                <label className="selector-label">Analytics Target</label>
                <p className="selector-sub">
                  Switching reports for Garbage Collection & Peak Hours
                </p>
              </div>
              <select
                className="analytics-bin-select"
                value={analyticsBinId || ""}
                onChange={(e) => setAnalyticsBinId(Number(e.target.value))}
              >
                {bins.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.location}
                  </option>
                ))}
              </select>
            </div>

            {analyticsBinId && (
              <>
                <AnalyticsSection
                  binId={analyticsBinId}
                  refreshKey={analyticsKey}
                  token={token}
                />
                <PeakHoursHeatmap
                  binId={analyticsBinId}
                  token={token}
                />
              </>
            )}

            <div className="bin-grid">
              {bins.map((bin) => (
                <BinCard
                  key={bin.id}
                  binId={bin.id}
                  binName={bin.name}
                  binLocation={bin.location}
                  dryPct={bin.dry?.fill_level_percent ?? null}
                  wetPct={bin.wet?.fill_level_percent ?? null}
                  dryRawDistance={bin.dry?.raw_distance_cm}
                  wetRawDistance={bin.wet?.raw_distance_cm}
                  dryUpdated={bin.dry?.last_updated}
                  wetUpdated={bin.wet?.last_updated}
                  onBinClick={openDetail}
                  onEditLocation={handleEditLocation}
                  onDeleteBin={handleDeleteBin}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {selectedBin && (
        <HistoryModal
          bin={selectedBin}
          history={history}
          onClose={() => {
            setSelectedBinId(null);
            setHistory([]);
          }}
        />
      )}
    </div>
  );
}
