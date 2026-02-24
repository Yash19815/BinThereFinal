# BinThere — Smart Dustbin Monitor

A real-time web dashboard for monitoring dustbin fill levels via ESP32 ultrasonic sensors. Each bin has two compartments (**Dry Waste** and **Wet Waste**), each measured by a separate HC-SR04 sensor.

## ✨ Features

- **Real-time fill levels** — WebSocket push on every sensor reading
- **Dual-compartment monitoring** — Dry 🌫 and Wet 💧 waste, each with vertical fill indicator
- **Color-coded status** — Green → Yellow → Orange → Red as bin fills
- **Notification alerts** — Bell badge when any compartment exceeds 80%
- **History modal** — Click a bin card to see a chart + table of last 50 readings
- **Dark mode** — Toggle in the profile dropdown, persisted across sessions
- **Persistent storage** — SQLite DB stores all measurements
- **Auto-reconnect** — WebSocket reconnects automatically on network loss
- **No hardware required to test** — included PowerShell simulation script

---

## 📁 Project Structure

```
demo-ultrasonic/
├── package.json          ← Root: run both servers with one command
│
├── server/               ← Node.js backend
│   ├── server.js         ← Express + SQLite + WebSocket
│   ├── bins.db           ← SQLite database (auto-created)
│   ├── package.json
│   └── .env              ← PORT, DB_PATH
│
├── client/               ← React frontend (Vite)
│   ├── src/
│   │   ├── App.jsx       ← Full dashboard (Header, BinCard, Modal...)
│   │   └── App.css       ← Design system (light + dark themes)
│   ├── package.json
│   └── .env              ← VITE_WS_URL, VITE_API_URL
│
├── ESP32_SAMPLE/         ← Arduino sketch
│   ├── ESP32_SAMPLE.ino  ← Reads 2 sensors, POSTs to server
│   ├── config.h          ← WiFi credentials + pin config (create from .example)
│   └── config.h.example  ← Template
│
├── test-sensor.ps1       ← Simulates ESP32 sensor data (Windows)
└── .gitignore
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **Arduino IDE** (only for uploading to ESP32)

### 1 — Install all dependencies

```bash
npm run install:all
```

### 2 — Start both servers together

```bash
npm run dev
```

This starts:

- **Backend** on `http://localhost:3001` (green prefix in terminal)
- **Frontend** on `http://localhost:5173` (blue prefix in terminal)

Then open **http://localhost:5173** in your browser.

---

## ⚙️ Configuration

### Backend (`server/.env`)

```env
PORT=3001
DB_PATH=./bins.db
```

### Frontend (`client/.env`)

```env
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

> When deploying, replace `localhost` with your server's IP/hostname in both files.

---

## 🔌 ESP32 Wiring

Two HC-SR04 sensors — one per compartment:

| Sensor        | Trig Pin | Echo Pin |
| ------------- | -------- | -------- |
| Dry Waste (1) | GPIO 5   | GPIO 18  |
| Wet Waste (2) | GPIO 19  | GPIO 21  |

VCC → 5V, GND → GND for both sensors.

### ESP32 Configuration

```bash
# Copy the template
copy ESP32_SAMPLE\config.h.example ESP32_SAMPLE\config.h
```

Edit `config.h`:

```cpp
#define WIFI_SSID     "Your_WiFi_Name"
#define WIFI_PASSWORD "Your_WiFi_Password"
#define SERVER_IP     "192.168.1.100"   // your PC's IP (run: ipconfig)
#define SERVER_PORT   "3001"
```

Upload `ESP32_SAMPLE.ino` to your board via Arduino IDE. The ESP32 will POST to `/api/sensor-data` every second.

> **Upload tip:** If upload fails, hold the **BOOT** button on the ESP32 while the IDE shows `Connecting...`

---

## 🌐 API Reference

### Endpoints

| Method | Path                        | Description                       |
| ------ | --------------------------- | --------------------------------- |
| `GET`  | `/api/health`               | Health check                      |
| `GET`  | `/api/bins`                 | All bins with current fill levels |
| `GET`  | `/api/bins/:id`             | Single bin + last 50 measurements |
| `POST` | `/api/bins/:id/measurement` | New measurement (REST)            |
| `POST` | `/api/sensor-data`          | Legacy ESP32 endpoint             |

### ESP32 → POST `/api/sensor-data`

```json
{ "sensor1": 12.5, "sensor2": 38.0 }
```

`sensor1` → Dry Waste, `sensor2` → Wet Waste. Fill level computed from `max_height_cm` (default 50 cm).

### REST → POST `/api/bins/1/measurement`

```json
{ "raw_distance_cm": 12.5, "compartment": "dry" }
```

Or send `fill_level_percent` directly if already computed on-device.

### WebSocket Events (`ws://localhost:3001`)

```json
{ "type": "state",  "bin": { ... } }   // sent on new connection
{ "type": "update", "bin": { ... } }   // sent on every new measurement
```

---
## User login/Logout with Toast notification
Default credential for login are ```admin/admin123```


## 🧪 Testing Without Hardware

```powershell
# Simulates both sensors sending random readings every 2 seconds
.\test-sensor.ps1
```

Or manually via PowerShell:

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/sensor-data -Method POST `
  -Body '{"sensor1": 10, "sensor2": 40}' -ContentType "application/json"
```

---

## 🔧 Troubleshooting

| Problem                      | Fix                                                            |
| ---------------------------- | -------------------------------------------------------------- |
| Port 3001 already in use     | `netstat -ano \| findstr :3001` → `taskkill /PID <pid> /F`     |
| WebSocket disconnected       | Backend not running. Run `npm run dev` from root               |
| Bin card shows "No data yet" | Send a test reading with `test-sensor.ps1`                     |
| ESP32 won't upload           | Hold **BOOT** during `Connecting...` phase in Arduino IDE      |
| ESP32 can't reach server     | Check `SERVER_IP` in `config.h` matches your PC's IPv4 address |
| WiFi won't connect           | Use 2.4GHz — ESP32 doesn't support 5GHz networks               |

---

## 🗄️ Database Management

The SQLite database (`server/bins.db`) stores all measurements and fill cycle records.

### Clear fill cycle history (analytics chart only)

```powershell
# Run from the server/ directory
node -e "import('better-sqlite3').then(({default:DB})=>{const db=new DB('./bins.db');const r=db.prepare('DELETE FROM fill_cycles').run();console.log('Deleted',r.changes,'fill cycle rows');db.close()})"
```

### Clear all raw measurements + fill cycles

```powershell
node -e "import('better-sqlite3').then(({default:DB})=>{const db=new DB('./bins.db');db.prepare('DELETE FROM measurements').run();db.prepare('DELETE FROM fill_cycles').run();console.log('All data cleared');db.close()})"
```

> **Note:** Restart the server after clearing so the in-memory fill-state cache resets.

---

## 🛠️ Tech Stack

| Layer       | Technology                        |
| ----------- | --------------------------------- |
| Frontend    | React 18, Vite, CSS Variables     |
| Backend     | Node.js, Express, ws (WebSocket)  |
| Database    | SQLite via `better-sqlite3`       |
| Hardware    | ESP32, HC-SR04 ultrasonic sensors |
| Dev tooling | concurrently                      |

---

## License

MIT
