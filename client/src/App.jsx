import { useEffect, useState, useRef } from "react";
import "./App.css";

function SensorCard({ label, data, getDistanceStatus, formatTime }) {
  if (!data) return null;
  const status = getDistanceStatus(data);
  return (
    <div className={`distance-card ${status}`}>
      <h2>{label}</h2>
      <div className="distance-value">
        {data.toFixed(2)}
        <span className="unit">cm</span>
      </div>
      <div className={`status-badge ${status}`}>
        {status === "far"
          ? "🟢 Far"
          : status === "medium"
            ? "🟡 Medium"
            : "🔴 Close"}
      </div>
      <div className="indicator-bar-container">
        <div
          className={`indicator-bar ${status}`}
          style={{ width: `${Math.min((data / 100) * 100, 100)}%` }}
        />
      </div>
      <div className="range-labels">
        <span>0cm</span>
        <span>50cm</span>
        <span>100cm+</span>
      </div>
    </div>
  );
}

function App() {
  const [sensorData, setSensorData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:3001";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setIsConnected(true);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setSensorData(data);
        setHistory((prev) => [data, ...prev].slice(0, 10));
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        setIsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };
    };

    connectWebSocket();
    return () => wsRef.current?.close();
  }, []);

  const getDistanceStatus = (distance) => {
    if (distance > 50) return "far";
    if (distance > 20) return "medium";
    return "close";
  };

  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString();

  return (
    <div className="app">
      <header className="header">
        <h1>Ultrasonic Sensor Reading</h1>
        <p className="subtitle">ESP32 Dual Sensor Monitor</p>
        <div
          className={`connection-status ${isConnected ? "connected" : "disconnected"}`}
        >
          <span className="status-dot"></span>
          {isConnected ? "Connected" : "Disconnected — retrying..."}
        </div>
      </header>

      <main className="main-content">
        {sensorData ? (
          <>
            <div className="sensor-grid">
              <SensorCard
                label="Sensor 1"
                data={sensorData.sensor1}
                getDistanceStatus={getDistanceStatus}
                formatTime={formatTime}
              />
              <SensorCard
                label="Sensor 2"
                data={sensorData.sensor2}
                getDistanceStatus={getDistanceStatus}
                formatTime={formatTime}
              />
            </div>
            <div className="last-updated">
              Last updated: {formatTime(sensorData.timestamp)}
            </div>
          </>
        ) : (
          <div className="no-data">
            <div className="pulse-ring"></div>
            <p>Waiting for sensor data...</p>
          </div>
        )}

        {history.length > 0 && (
          <div className="history-section">
            <h3>Recent Readings</h3>
            <div className="history-list">
              <div className="history-header">
                <span>Time</span>
                <span>Sensor 1</span>
                <span>Sensor 2</span>
              </div>
              {history.map((reading, index) => (
                <div key={index} className="history-item">
                  <span className="history-time">
                    {formatTime(reading.timestamp)}
                  </span>
                  <span
                    className={`history-badge ${getDistanceStatus(reading.sensor1)}`}
                  >
                    {reading.sensor1.toFixed(2)} cm
                  </span>
                  <span
                    className={`history-badge ${getDistanceStatus(reading.sensor2)}`}
                  >
                    {reading.sensor2.toFixed(2)} cm
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
