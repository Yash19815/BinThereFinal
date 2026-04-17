# BinThere — Smart Dustbin Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![ESP32](https://img.shields.io/badge/Hardware-ESP32-red)](https://www.espressif.com/)

A real-time web dashboard for monitoring dustbin fill levels via ESP32 ultrasonic sensors. Each bin has two compartments (**Dry Waste** and **Wet Waste**), each measured by a separate HC-SR04 sensor.

> **Perfect for:** Smart waste management systems, IoT monitoring projects, environmental tracking, or testing sensor integrations without hardware.

## ✨ Features

- **Secure login** — JWT-based authentication with bcrypt password hashing
- **Real-time fill levels** — WebSocket push on every sensor reading
- **Dual-compartment monitoring** — Dry 🌫 and Wet 💧 waste, each with vertical fill indicator
- **Average fill bar** — Card footer shows average fill of both compartments
- **Color-coded status** — Green → Yellow → Orange → Red as bin fills
- **Notification alerts** — Bell badge when any compartment exceeds 80%
- **History modal** — Click a bin card to see a chart + table of last 50 readings
- **Analytics chart** — Daily fill-cycle trend graph (7 / 14 / 30 day range)
- **Excel export** — Downloads Bins, Measurements, Fill Cycles, and Summary in IST with optional date-range filtering
- **Toast notifications** — Login, logout, and error feedback via react-hot-toast
- **Intelligent detection** — Automatically detects your PC's IP address for seamless ESP32 and mobile testing
- **Dynamic dark mode** — Real-time HSL color palette switching for charts and heatmaps
- **Peak Fill Hours Heatmap** — 7x24 matrix visualizing average fill cycles per compartment
- **Linear data visualization** — Accurate trend lines in Analytics and History charts
- **Daily Data Purge** — Automatically deletes measurements older than 1 year to keep the database lean
- **Advanced Development Tools** — Built-in serial monitor and OTA update utility for hardware management
- **No hardware required to test** — included PowerShell simulation script

  ***

## 📁 Project Structure

```
demo-ultrasonic/
├── package.json              ← Root: run both servers with one command
├── README.md
├── test-sensor.ps1
│
├── client/                   ← React frontend (Vite)
├── server/                   ← Node.js backend (Express + SQLite)
│
├── Final_code/               ← Main ESP32 Pipeline (Microwave + Ultrasonic + Servos)
│   ├── binthere_final_pipeline.ino
│   ├── config.h.example      ← Template for WiFi & API key
│   └── webpage.h             ← Built-in Web Serial Monitor UI
│
├── ota_check/                ← dummy code to check the OTA feature
│   └── ota_confirm.ino
│
├── serial_monitor/           ← Web-based Hardware Debugger
│   └── monitor.html          ← Standalone Serial Monitor & Firmware Flasher (via WebUSB)
│
├── python_scripts/           ← Master automation scripts
│   ├── binthere_master.py
│   └── requirements.txt
│
└── ... (explained in additional docs)
```

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

- **Backend** on `http://localhost:3001`
- **Frontend** on `http://localhost:5173`

> **💡 Smart Host Detection:** The app automatically replaces `localhost` with your actual IP address (e.g., `192.168.1.5`) when you access it from another device on your network. This ensures the ESP32 and mobile browsers can always find the backend without manual config changes.

Then open **http://localhost:5173** and log in with the default credentials:

| Username | Password   |
| -------- | ---------- |
| `admin`  | `admin123` |

> The default admin account is created automatically on first startup if no users exist.

---

## ⚙️ Configuration

### Backend (`server/.env`)

```env
PORT=3001
HOST=0.0.0.0
DB_PATH=./bins.db

# Auth
JWT_SECRET=change_this_to_a_long_random_secret
JWT_EXPIRES_IN=7d

# Default admin account (auto-created on first startup)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# Optional hardware key (for protected routes from device)
DEVICE_API_KEY=binthere-esp32-device-key-2026
```

> **⚠️ Before deploying:** Set a strong `JWT_SECRET` and change `DEFAULT_ADMIN_PASSWORD`.

### Frontend (`client/.env`)

```env
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

> When deploying, replace `localhost` with your server's IP/hostname in both files.

---

# ESP32 Pin Connection Reference

## Quick Connection Map

## Microwave Sensor (RCWL-0516)

| Pin | Connected To       | Notes                                        |
| --- | ------------------ | -------------------------------------------- |
| VIN | ESP32 VIN          | Powered directly from ESP32 VIN              |
| OUT | GPIO 14            | Signal output pin                            |
| GND | Common ground rail | Shared with ESP32 GND                        |
| 3V3 | VL53L0X VIN        | Powers TOF sensor (~20mA, 100mA rated limit) |

---

## SG90 Servo Motor

| Pin          | Wire Color | Connected To       | Notes                         |
| ------------ | ---------- | ------------------ | ----------------------------- |
| Power (VCC)  | Red        | External 5V supply | Stable 5V shared power supply |
| Signal (PWM) | Orange     | GPIO 13            | PWM control signal from ESP32 |
| GND          | Brown      | Common ground rail | Shared with ESP32 GND         |

---

## MG995 Servo Motor

| Pin          | Wire Color | Connected To       | Notes                             |
| ------------ | ---------- | ------------------ | --------------------------------- |
| Power (VCC)  | Red        | External 5V supply | Stable 5V shared power supply     |
| Signal (PWM) | Orange     | GPIO 32            | 50Hz PWM, pulse width 1000–2000µs |
| GND          | Brown      | Common ground rail | Shared with ESP32 GND             |

> ⚠️ MG995 draws up to 1200mA under load — ensure your 5V supply is rated for enough current to handle both servos simultaneously.

---

## Ultrasonic Sensor 1

| Pin  | Connected To       | Notes                   |
| ---- | ------------------ | ----------------------- |
| VCC  | 3.3V               | Powered from ESP32 3.3V |
| TRIG | GPIO 5             | Trigger pin             |
| ECHO | GPIO 18            | Echo input              |
| GND  | Common ground rail | Shared with ESP32 GND   |

---

## Ultrasonic Sensor 2

| Pin  | Connected To       | Notes                   |
| ---- | ------------------ | ----------------------- |
| VCC  | 3.3V               | Powered from ESP32 3.3V |
| TRIG | GPIO 19            | Trigger pin             |
| ECHO | GPIO 21            | Echo input              |
| GND  | Common ground rail | Shared with ESP32 GND   |

---

## Soil Moisture Sensor

| Pin                | Connected To       | Notes                    |
| ------------------ | ------------------ | ------------------------ |
| Power              | GPIO 27            | Power control from ESP32 |
| AO (Analog Output) | GPIO 34            | Analog data input        |
| GND                | Common ground rail | Common ground            |

---

## VL53L0X TOF Laser Distance Sensor

| Pin | Connected To       | Notes                                       |
| --- | ------------------ | ------------------------------------------- |
| VIN | RCWL-0516 3V3 pin  | Draws ~20mA, within RCWL-0516's 100mA limit |
| GND | Common ground rail | Shared with ESP32 GND                       |
| SDA | GPIO 25            | Custom I2C data (GPIO 21 already in use)    |
| SCL | GPIO 22            | Custom I2C clock                            |

> ⚠️ Initialize I2C manually in code: `Wire.begin(25, 22);` before calling the VL53L0X library.

---

## GPIO Summary

| GPIO    | Assigned To              |
| ------- | ------------------------ |
| GPIO 5  | Ultrasonic 1 TRIG        |
| GPIO 13 | SG90 Signal              |
| GPIO 14 | Microwave OUT            |
| GPIO 18 | Ultrasonic 1 ECHO        |
| GPIO 19 | Ultrasonic 2 TRIG        |
| GPIO 21 | Ultrasonic 2 ECHO        |
| GPIO 22 | VL53L0X SCL              |
| GPIO 25 | VL53L0X SDA              |
| GPIO 27 | Soil Moisture Power      |
| GPIO 32 | MG995 Signal             |
| GPIO 34 | Soil Moisture AO (Input) |

---

## ESP32 Setup

### Required Arduino Libraries

To compile the firmware, you must install the following libraries via the **Arduino Library Manager** (Ctrl+Shift+I):

- **ESP32Servo** by Kevin Harrington
- **Adafruit VL53L0X** by Adafruit
- **ESPAsyncWebServer** by Me-No-Dev (and its dependency **AsyncTCP**)
- **ElegantOTA** by Ayush Sharma
  - _Note: In `ElegantOTA.h`, ensure you set `#define ELEGANTOTA_USE_ASYNC_WEBSERVER 1`._

Built-in libraries (no installation needed): `WiFi`, `HTTPClient`, `Wire`, `Preferences`, `esp_task_wdt`.

### Main Pipeline (`Final_code`)

The primary firmware for the BinThere hardware.

1.  **Configure Credentials**:
    ```bash
    # Copy the template
    copy Final_code\config.h.example Final_code\config.h
    ```
2.  **Edit `config.h`**: Fill in your `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_IP`.
3.  **Upload**: Open `binthere_final_pipeline.ino` in Arduino IDE and upload to your ESP32.

### OTA Update Utility (`ota_check`)

Used for a dummy check if the OTA code snippet is working or not.

### Web Serial Monitor (`serial_monitor`)

The `serial_monitor/monitor.html` file provides a browser-based interface to view hardware logs and flash firmware directly without the Arduino IDE.

    ---

## 🌐 API Reference

### Authentication (public — no token required)

| Method | Path                 | Description                     |
| ------ | -------------------- | ------------------------------- |
| `POST` | `/api/auth/login`    | Login → returns JWT token       |
| `POST` | `/api/auth/register` | Register new user → returns JWT |
| `POST` | `/api/sensor-data`   | Legacy dual-sensor ingest       |

### Protected endpoints (JWT or device key)

Protected routes accept either:

- `Authorization: Bearer <token>`
- `X-Device-Key: <DEVICE_API_KEY>`

| Method | Path                        | Description                                         |
| ------ | --------------------------- | --------------------------------------------------- |
| `GET`  | `/api/auth/me`              | Verify token, return user info                      |
| `GET`  | `/api/health`               | Health check                                        |
| `GET`  | `/api/bins`                 | All bins with current fill levels                   |
| `GET`  | `/api/bins/:id`             | Single bin + last 50 measurements                   |
| `GET`  | `/api/bins/:id/analytics`   | Daily fill-cycle chart data                         |
| `GET`  | `/api/bins/:id/heatmap`     | 7x24 heatmap matrix of fill events                  |
| `POST` | `/api/bins/:id/measurement` | New measurement (single compartment)                |
| `GET`  | `/api/export/excel`         | Excel export (IST timestamps + optional date range) |

### ESP32 → POST `/api/sensor-data`

```
{ "sensor1": 12.5, "sensor2": 38.0 }
```

`sensor1` → Dry Waste, `sensor2` → Wet Waste. Fill level is computed from `max_height_cm`.

### Single Compartment → POST `/api/bins/:id/measurement`

```
  { "raw_distance_cm": 14.2, "compartment": "dry" }
```

Alternative body:

```
  { "fill_level_percent": 62.5, "compartment": "wet" }
```

### Excel Export (`GET /api/export/excel`)

Downloads an `.xlsx` file containing:

- `Bins` — bin metadata
- `Measurements` — sensor readings (with `Date (IST)` + `Time (IST)`)
- `Fill Cycles` — fill/empty events (timestamps displayed in IST)
- `Summary` — top-level counts and overview stats

Optional query params (interpreted as IST dates):

- `from=YYYY-MM-DD` — start date (inclusive)
- `to=YYYY-MM-DD` — end date (inclusive, through `23:59:59`)

### WebSocket Events (`ws://localhost:3001`)

```
{ "type": "state",  "bin": { ... } }
{ "type": "update", "bin": { ... } }
```

---

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

    | Problem                        | Fix                                                                      |
    | ------------------------------ | ------------------------------------------------------------------------ |
    | Port 3001 already in use       | `netstat -ano \| findstr :3001` → `taskkill /PID <pid> /F`               |
    | WebSocket disconnected         | Backend not running. Run `npm run dev` from root                         |
    | Bin card shows "No data yet"   | Send a test reading with `test-sensor.ps1`                               |
    | Analytics chart not showing    | Make sure you're logged in — chart data requires authentication          |
    | ESP32 `POST Error: -1`         | `SERVER_IP` in config doesn't match your PC's current IPv4 address       |
    | ESP32 won't upload             | Hold **BOOT** during `Connecting...` phase in Arduino IDE                |
    | WiFi won't connect             | Use 2.4 GHz — ESP32 doesn't support 5 GHz networks                       |
    | Device key auth fails          | Check `DEVICE_API_KEY` and `X-Device-Key` header match exactly           |

    ---

### Automatic Data Purge

The server includes a background task that runs every 24 hours. It deletes measurement records older than 1 year and performs a `VACUUM` on the database to maintain performance and storage efficiency.

### Manual Data Cleanup

#### Clear fill cycle history (analytics chart only)

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

| Layer       | Technology                                   |
| ----------- | -------------------------------------------- |
| Frontend    | React 18, Vite, CSS Variables                |
| Auth (UI)   | AuthContext (React Context), react-hot-toast |
| Backend     | Node.js, Express, ws (WebSocket)             |
| Auth (API)  | jsonwebtoken (JWT), bcryptjs                 |
| Database    | SQLite via `better-sqlite3`                  |
| Export      | ExcelJS                                      |
| Hardware    | ESP32, HC-SR04 ultrasonic sensors            |
| Dev tooling | concurrently, nodemon                        |

## 📚 Additional Documentation

- **[BinThere Code Explained](./BinThere_Code_Explained.md)** — Detailed breakdown of frontend architecture and components
- **[Dashboard Code Explained](./BinThere_Dashboard_Code_Explained.md)** — Backend logic and API design walkthrough
- **[Export Feature Guide](./EXPORT_FEATURE_GUIDE.md)** — How to configure and use data export functionality

  ***

## 💻 Development

### File Structure

- **`client/src/App.jsx`** — Main dashboard, WebSocket client, Analytics charts, and Peak Hours Heatmap
- **`client/src/AuthContext.jsx`** — Global auth state & dynamic API host resolution
- **`client/src/LoginPage.jsx`** — Full-screen login form with error handling
- **`client/src/components/ExportToExcel.jsx`** — Excel export UI component
- **`server/server.js`** — Express server, WebSocket setup, API endpoints, database initialization
- **`server/exportRoutes.js`** — Excel export route implementation with IST date handling
- **`server/schema.sql`** — SQL schema reference for all database tables

### Available Commands

```bash
# Install dependencies for both client and server
npm run install:all

# Start development servers (frontend + backend concurrently)
npm run dev

# Format code with Prettier
npm run format

# Kill ports if they're stuck
npm run kill-port 3001 5173

# Run just the server
npm run server

# Run just the client
npm run client
```

### Environment Variables

Create `.env` files in both `server/` and `client/` directories:

**server/.env:**

```
  PORT=3001
  HOST=0.0.0.0
  DB_PATH=./bins.db
  JWT_SECRET=your-secret-key-change-this
  JWT_EXPIRES_IN=7d
  DEFAULT_ADMIN_USERNAME=admin
  DEFAULT_ADMIN_PASSWORD=admin123
  DEVICE_API_KEY=binthere-esp32-device-key-2026
```

**client/.env:**

```env
# Optional: The app now auto-detects your hostname. 
# Use these only if you need to hardcode a specific production domain.
VITE_WS_URL=ws://localhost:3001
VITE_API_URL=http://localhost:3001
```

### Real-time Updates

The dashboard uses **WebSocket** for live updates: - Every sensor reading triggers a `ws.send(JSON.stringify({ type: 'update', bin: {...} }))` - Frontend receives updates and patches the bins array in-place - No polling — truly real-time data flow

### Authentication Flow

1. User logs in via `POST /api/auth/login`
2. Server validates credentials and returns JWT token
3. Frontend stores token and includes it in all API requests as `Authorization: Bearer <token>`
4. Token automatically refreshed before expiry (7 days default)
5. Dashboard verifies token on mount with `GET /api/auth/me`

---

## 🚀 Deployment Guide

### Frontend Deployment (Vercel / Netlify / GitHub Pages)

1. Build the frontend:

```bash
    npm run build --prefix client
```

Output: `client/dist/` directory

2. Deploy `client/dist/` to your hosting platform

3. Update `client/.env.production`:

```
VITE_API_URL=https://your-api-domain.com
VITE_WS_URL=wss://your-api-domain.com
```

### Backend Deployment (Heroku / Railway / AWS EC2)

1. Set production environment variables:

```bash
DATABASE_URL=your-production-db-path
JWT_SECRET=very-long-random-secret-string
DEFAULT_ADMIN_PASSWORD=strong-production-password
NODE_ENV=production
```

2. Install dependencies and start:

```bash
npm install --prefix server
npm start --prefix server
```

3. Ensure WebSocket support is enabled on your hosting platform

### Database Backup

Before deploying:

- Back up `server/bins.db`
- Consider migrating to PostgreSQL for production use
- Set up automated database backups

  ***

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository** — Click the fork button on GitHub
2. **Create a feature branch** — `git checkout -b feature/your-feature-name`
3. **Make your changes** — Implement your feature or fix
4. **Test thoroughly** — Use the test script or hardware to validate
5. **Format your code** — `npm run format`
6. **Commit with clear messages** — `git commit -m "Add: description of changes"`
7. **Push and open a PR** — `git push origin feature/your-feature-name`

### Code Style

- **Frontend:** React functional components with hooks, CSS modules
- **Backend:** Express.js with modular route handlers
- **Format:** Prettier with default settings (`npm run format`)
- **Comments:** Only for complex logic; code should be self-documenting

  ***

## 📖 FAQ

**Q: Can I use this without an ESP32?**
A: Yes! Use the included `test-sensor.ps1` script to simulate sensor readings.

**Q: How do I change the fill-level thresholds?**
A: Edit `max_height_cm` in the bin configuration and adjust the `ALERT_THRESHOLD`constant in `client/src/App.jsx`.

**Q: Is this production-ready?**
A: Not yet. The app is designed for monitoring and testing. For production, consider:

- Using PostgreSQL instead of SQLite
- Adding role-based access control (RBAC)
- Implementing API rate limiting
- Adding input validation and sanitization
- Setting up automated backups

**Q: How do I debug WebSocket issues?**
A: Open browser DevTools (F12) → Network tab → WS filter. You'll see all WebSocketmessages in real-time.

**Q: Can I add more bins?**
A: Yes! The API supports unlimited bins. Add a new bin via the database or APIendpoint (once implemented).

## License

MIT
