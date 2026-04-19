import { useState, useCallback, useEffect } from 'react';
import { API_URL, authHeaders } from '../utils/constants';
import { useWebSocket } from './useWebSocket';

export function useBins(token) {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [analyticsKey, setAnalyticsKey] = useState(0);
  const [analyticsBinId, setAnalyticsBinId] = useState(null);

  const fetchBins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/bins`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw new Error("Failed to fetch bins");
      const json = await res.json();
      if (json.bins) setBins(json.bins);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchBins();
  }, [fetchBins]);

  useEffect(() => {
    if (bins.length > 0 && !analyticsBinId) {
      setAnalyticsBinId(bins[0].id);
    }
  }, [bins, analyticsBinId]);

  const handleWebSocketMessage = useCallback((msg) => {
    if (msg.type === "state" || msg.type === "update" || msg.type === "new") {
      setBins((prev) => {
        const idToFind = msg.type === "new" ? msg.bin.id : (msg.bin?.id);
        const idx = prev.findIndex((b) => b.id === idToFind);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = msg.bin;
          return next;
        }
        return [...prev, msg.bin];
      });
      if (msg.type === "update") {
        setAnalyticsKey((k) => k + 1);
      }
    } else if (msg.type === "delete") {
      setBins((prev) => prev.filter((b) => b.id !== msg.binId));
      setAnalyticsBinId((prevId) => prevId === msg.binId ? null : prevId);
    }
  }, []);

  useWebSocket({
    onMessage: handleWebSocketMessage,
    onStatusChange: setWsStatus,
  });

  const addBin = async (name, location) => {
    const res = await fetch(`${API_URL}/api/bins`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name, location }),
    });
    const json = await res.json();
    if (json.status === "success") {
      setBins((prev) => [...prev, json.bin]);
      return true;
    }
    throw new Error(json.message);
  };

  const updateBinLocation = async (binId, location) => {
    const res = await fetch(`${API_URL}/api/bins/${binId}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
    const json = await res.json();
    if (json.status === "success") {
      setBins((prev) =>
        prev.map((b) => (b.id === binId ? { ...b, location: json.bin.location } : b))
      );
      return true;
    }
    throw new Error(json.message);
  };

  const deleteBin = async (binId) => {
    const res = await fetch(`${API_URL}/api/bins/${binId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const json = await res.json();
    if (json.status === "success") {
      setBins((prev) => prev.filter((b) => b.id !== binId));
      return true;
    }
    throw new Error(json.message);
  };

  return {
    bins,
    loading,
    error,
    wsStatus,
    analyticsKey,
    analyticsBinId,
    setAnalyticsBinId,
    refreshBins: fetchBins,
    addBin,
    updateBinLocation,
    deleteBin,
  };
}
