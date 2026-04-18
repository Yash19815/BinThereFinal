# BinThere — Smart Waste Intelligence Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32-red)](https://www.espressif.com/)

BinThere is a high-fidelity, real-time monitoring ecosystem designed for smart waste management. It utilizes ESP32-bound ultrasonic sensors to track fill levels in dual-compartment bins (**Dry Waste** and **Wet Waste**), providing actionable insights through a premium web dashboard.

> [!TIP]
> **No hardware? No problem.** Use the included simulation utility to test the full-stack dashboard immediately.

---

## 💎 Core Capabilities

### 📡 Real-Time Monitoring

- **WebSocket Synchronization**: Live updates are pushed to the dashboard on every sensor trigger—no manual refreshing required.
- **Dual-Compartment Visualization**: Individual vertical fill gauges for Dry and Wet waste categories.
- **Dynamic Status Indicators**: Intelligent color-coding (Green → Yellow → Orange → Red) based on real-time fill density.
- **Notification Engine**: Integrated alert system (visual badge + toast notifications) for compartments exceeding 80% capacity.
- **Dynamic Bin Management**: Add, edit, or delete dustbins directly from the dashboard UI with instant WebSocket propagation.

### 📊 Advanced Analytics

- **Fill-Cycle Intelligence**: Automatically detects and records "Fill Events" when a bin is emptied and subsequently refilled.
- **Time-Series Data**: Interactive trend charts supporting 7, 14, and 30-day historical views.
- **Peak Hours Heatmap**: A 24x7 density matrix visualizing waste accumulation patterns throughout the week.
- **Precise History**: Deep-dive into the last 50 measurements for any specific bin with micro-trendline visualizations.

### 🛠️ Hardware & DevOps Utilities

- **One-Click Configuration**: Automated setup script for dependency management and environment synchronization.
- **Dynamic Host Discovery**: Zero-config networking; the dashboard automatically detects your server's IP for cross-device testing.
- **Web-Based Debugger**: Integrated serial monitor and OTA (Over-The-Air) update capability for hardware management.
- **Lean Data Management**: Automated 24-hour background task that purges historical data older than a year to maintain DB performance.

### 📤 Data Portability

- **Excel Intelligence**: High-fidelity reports with IST timestamping and recursive data sheets (Bins, Measurements, Cycles, Summary).
- **Date-Range Filtering**: Export specific temporal windows for compliance and reporting.

---

---

## 📂 Project Structure

```text
Bintethere-Final/
├── scripts/                  ← Setup and configuration utilities
│   └── setup.js              ← Automated one-click installer
├── package.json              ← Root manager (concurrent dev startup)
│
├── client/                   ← React/Vite Frontend
│   ├── src/App.jsx           ← Main Orchestrator (WebSocket + Charts)
│   └── src/AuthContext.jsx   ← Secure Auth & API Discovery
│
├── server/                   ← Node.js/Express Backend
│   ├── server.js             ← API, WebSocket, & Database Logic
│   └── exportRoutes.js       ← IST-localized Excel Generation
│
├── Final_code/               ← Main ESP32 Pipeline (C++/Arduino)
│   ├── binthere_final_pipeline.ino
│   └── config.h.example      ← Hardware config template
│
├── serial_monitor/           ← WebUSB-based Hardware Debugger
│   └── monitor.html          ← Standalone Browser Debugger
│
├── python_scripts/           ← Master automation tools
│   └── binthere_master.py
│
├── test-sensor.ps1           ← Hardware simulation utility
└── ... (additional docs)
```

## 🚀 Quick Start

Get your environment synchronized and the dashboard running in two steps.

### 1. Unified Setup

Run the automated configuration script to install all dependencies and initialize environment variables:

```bash
npm run configure
```

### 2. Launch

Start the full-stack development environment (Backend + Dashboard):

```bash
npm run dev
```

The system will initialize:

- **API Backend**: `http://localhost:3001`
- **React Dashboard**: `http://localhost:5173`

> [!NOTE]
> **Network Transparency**: The dashboard automatically bridges to your machine's local IP (e.g., `192.168.x.x`). This allows ESP32 devices and mobile browsers on the same network to communicate with the backend without manual configuration.

### 🔐 Default Access

Open **http://localhost:5173** and authenticate with the pre-seeded admin account:

| Username | Password   |
| :------- | :--------- |
| `admin`  | `admin123` |

---

## ⚙️ Configuration

The system is designed to work with minimal manual editing. Most variables are initialized automatically by `npm run configure`.

### Key Environment Settings

| Variable         | Default Scope | Description                                    |
| :--------------- | :------------ | :--------------------------------------------- |
| `PORT`           | Backend       | Server listener port (Standard: 3001)          |
| `JWT_SECRET`     | Backend       | Root secret for secure session tokens          |
| `DB_PATH`        | Backend       | Path to the `bins.db` SQLite storage           |
| `DEVICE_API_KEY` | Backend       | Static bypass key for hardware authentications |
| `VITE_API_URL`   | Frontend      | Bridge URL (auto-generated for local IP)       |

> [!WARNING]
> **Production Security**: The development setup generates a unique `JWT_SECRET`. For production deployments, ensure all secrets are managed via a secure environment manager.

---

## 📡 API Reference

### 🔓 Public Endpoints

No authentication required.

| Method | Path                 | Description                             |
| :----- | :------------------- | :-------------------------------------- |
| `POST` | `/api/auth/login`    | Authenticate and retrieve JWT           |
| `POST` | `/api/auth/register` | Create a new account                    |
| `POST` | `/api/sensor-data`   | **Legacy** dual-sensor ingest (Dry/Wet) |

### 🔒 Protected Endpoints

Requires `Authorization: Bearer <token>` or `X-Device-Key: <key>`.

| Method | Path                        | Description                              |
| :----- | :-------------------------- | :--------------------------------------- |
| `GET`  | `/api/auth/me`              | Resolve current user profile             |
| `GET`  | `/api/health`               | System liveness & connection probe       |
| `GET`  | `/api/bins`                 | Retrieve all bins & current states       |
| `GET`  | `/api/bins/:id`             | Single bin details + measurement history |
| `GET`  | `/api/bins/:id/analytics`   | Daily fill-cycle trend data              |
| `GET`  | `/api/bins/:id/heatmap`     | 24x7 peak hours matrix                   |
| `POST` | `/api/bins`                 | Register a new dustbin (Admin)           |
| `PATCH`| `/api/bins/:id`             | Update bin metadata (e.g., location)     |
| `DELETE`| `/api/bins/:id`            | Remove a bin and cascade delete data     |
| `POST` | `/api/bins/:id/measurement` | Record per-compartment reading           |
| `GET`  | `/api/export/excel`         | Multi-sheet data export (IST)            |

---

## 🔌 Hardware Architecture

The system utilizes an ESP32 microcontroller to interface with diverse sensors and actuators.

### Pin Connection Map

| Peripheral       | Component     | Pin (ESP32)   | Notes                         |
| :--------------- | :------------ | :------------ | :---------------------------- |
| **Motion**       | RCWL-0516     | `GPIO 14`     | Microwave presence detection  |
| **Waste (Dry)**  | HC-SR04       | `GPIO 5/18`   | Trig/Echo pair                |
| **Waste (Wet)**  | HC-SR04       | `GPIO 19/21`  | Trig/Echo pair                |
| **Precision**    | VL53L0X       | `I2C (25/22)` | TOF Laser Sensor (Custom I2C) |
| **Lid Control**  | SG90          | `GPIO 13`     | Smart Lid PWM                 |
| **Flap Control** | MG995         | `GPIO 32`     | Category Filter PWM           |
| **Condition**    | Soil Moisture | `GPIO 34/27`  | Analog Input + Power Control  |

> [!CAUTION]
> **Power Budget**: The MG995 servo can draw up to 1.2A under load. Use an external 5V regulated power source; do not power high-torque servos directly from the ESP32 5V pin.

### Firmware Pipeline

1. **Source**: Locate `Final_code/binthere_final_pipeline.ino`.
2. **Setup**: Create `config.h` from the provided template.
3. **Libraries**: Required: `ESP32Servo`, `Adafruit_VL53L0X`, `ESPAsyncWebServer`, `ElegantOTA`.
4. **OTA**: Update over-the-air via `http://<device-ip>/update` after first flash.

---

## 🧪 Simulation & Testing

**Simulate Hardware (PowerShell)**:
Run the interactive simulation script to push randomized measurements to the dashboard:

```powershell
.\test-sensor.ps1
```

**Verify API Liveness**:

```bash
curl http://localhost:3001/api/health
```

---

## 🛠️ Tech Stack & Ecosystem

| Layer         | Standard                                        |
| :------------ | :---------------------------------------------- |
| **UI/UX**     | React 18 / Vite / Vanilla CSS (Modern Tokens)   |
| **Server**    | Node.js (Express) / WebSocket (ws)              |
| **Auth**      | JWT / Bcrypt (Secure Hashing)                   |
| **Database**  | Better-SQLite3 (High-performance native driver) |
| **Analytics** | Chart.js 4 / 24x7 Custom Heatmap Grid           |
| **Hardware**  | C++ (Arduino/ESP32)                             |

---

## 📚 Related Documentation

- 📄 **[BinThere Code Explained](./BinThere_Code_Explained.md)**: Deep dive into the React components & UI logic.
- 📄 **[Dashboard Design](./BinThere_Dashboard_Code_Explained.md)**: Backend architecture and API design patterns.
- 📄 **[Export System](./EXPORT_FEATURE_GUIDE.md)**: Detailed guide for IST-localized Excel reporting.

---

## 📖 FAQ & Maintenance

**Q: How do I change fill-level thresholds?**  
A: Update the `ALERT_THRESHOLD` in `client/src/App.jsx` and the `max_height_cm` field in the database.

**Q: Is there an automatic data cleanup?**  
A: Yes. The server runs a background task every 24 hours that purges measurements older than 1 year to keep the SQLite environment optimized.

**Q: How do I fix "WebSocket Disconnected" errors?**  
A:

- Ensure the backend is running via `npm run dev`.
- Verify your browser isn't blocking local network connections.
- The app auto-detects your hostname, but check the console for any IP mismatch logs.

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
