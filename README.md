    # BinThere — Smart Dustbin Monitor

    A real-time web dashboard for monitoring dustbin fill levels via ESP32 ultrasonic sensors. Each bin has two compartments (**Dry Waste** and **Wet Waste**), each measured by a separate HC-SR04 sensor.

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
    - **Dark mode** — Toggle in the profile dropdown, persisted across sessions
    - **Persistent storage** — SQLite DB stores all measurements, fill cycle events, and users
    - **Auto-reconnect** — WebSocket reconnects automatically on network loss
    - **No hardware required to test** — included PowerShell simulation script

    ---

    ## 📁 Project Structure

    ```text
    demo-ultrasonic/
    ├── package.json              ← Root: run both servers with one command
    ├── README.md
    ├── test-sensor.ps1
    │
    ├── client/                   ← React frontend (Vite)
    │   ├── index.html
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── vite.config.js
    │   ├── public/
    │   └── src/
    │       ├── App.jsx           ← Dashboard (Header, BinCard, Analytics, Modal…)
    │       ├── App.css           ← Design system (light + dark themes)
    │       ├── AuthContext.jsx   ← Global auth state (login / logout / rehydration)
    │       ├── LoginPage.jsx     ← Full-screen login form
    │       ├── main.jsx
    │       ├── main.ts
    │       ├── style.css
    │       ├── counter.ts
    │       └── components/
    │           └── ExportToExcel.jsx
    │
    ├── server/                   ← Node.js backend
    │   ├── server.js             ← Express + SQLite + WebSocket + Auth
    │   ├── exportRoutes.js       ← Excel export route (IST filters + formatting)
    │   ├── schema.sql            ← SQL schema reference
    │   ├── bins.db               ← SQLite database (auto-created)
    │   ├── package.json
    │   └── .env                  ← PORT, HOST, DB_PATH, JWT_SECRET, DEVICE_API_KEY…
    │
    ├── ESP32_SAMPLE/             ← Full worker sketch (UART + servos + soil + dashboard post)
    │   ├── ESP32_SAMPLE.ino
    │   ├── config.h              ← WiFi credentials + pin config (create from .example)
    │   └── config.h.example      ← Template
    │
    ├── ESP32_SINGLE_SENSOR/      ← Minimal single-sensor sketch (POST /api/bins/1/measurement)
    │   └── ESP32_SINGLE_SENSOR.ino
    │
    └── python_scripts/
        ├── binthere_master.py
        └── requirements.txt
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

    - **Backend** on `http://localhost:3001`
    - **Frontend** on `http://localhost:5173`

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

---

## Microwave Sensor (RCWL-0516)

| Pin | Connected To       | Notes                                        |
| --- | ------------------ | -------------------------------------------- |
| VIN | ESP32 VIN          | Powered directly from ESP32 VIN              |
| OUT | GPIO 14            | Signal output pin                            |
| GND | Common ground rail | Shared with ESP32 GND                        |
| 3V3 | VL53L0X VIN        | Powers TOF sensor (~20mA, 100mA rated limit) |

---

## SG90 Servo Motor

| Pin          | Wire Color | Connected To        | Notes                             |
| ------------ | ---------- | ------------------- | --------------------------------- |
| Power (VCC)  | Red        | External 5V supply  | Stable 5V shared power supply     |
| Signal (PWM) | Orange     | GPIO 13             | PWM control signal from ESP32     |
| GND          | Brown      | Common ground rail  | Shared with ESP32 GND             |

---

## MG995 Servo Motor

| Pin          | Wire Color | Connected To        | Notes                                         |
| ------------ | ---------- | ------------------- | --------------------------------------------- |
| Power (VCC)  | Red        | External 5V supply  | Stable 5V shared power supply                 |
| Signal (PWM) | Orange     | GPIO 32             | 50Hz PWM, pulse width 1000–2000µs             |
| GND          | Brown      | Common ground rail  | Shared with ESP32 GND                         |

> ⚠️ MG995 draws up to 1200mA under load — ensure your 5V supply is rated for enough current to handle both servos simultaneously.

---

## Ultrasonic Sensor 1

| Pin  | Connected To | Notes                        |
| ---- | ------------ | ---------------------------- |
| VCC  | 3.3V         | Powered from ESP32 3.3V      |
| TRIG | GPIO 5       | Trigger pin                  |
| ECHO | GPIO 18      | Echo input                   |
| GND  | Common ground rail | Shared with ESP32 GND  |

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

| Pin | Connected To       | Notes                                        |
| --- | ------------------ | -------------------------------------------- |
| VIN | RCWL-0516 3V3 pin  | Draws ~20mA, within RCWL-0516's 100mA limit  |
| GND | Common ground rail | Shared with ESP32 GND                        |
| SDA | GPIO 25            | Custom I2C data (GPIO 21 already in use)     |
| SCL | GPIO 22            | Custom I2C clock                             |

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

    ### ESP32 Sample Configuration (`ESP32_SAMPLE`)

    ```bash
    # Copy the template
    copy ESP32_SAMPLE\config.h.example ESP32_SAMPLE\config.h
    ```

    Edit `config.h`:

    ```cpp
    #define WIFI_SSID     "Your_WiFi_Name"
    #define WIFI_PASSWORD "Your_WiFi_Password"
    #define SERVER_IP     "192.168.1.11"   // your PC's IP — run: ipconfig
    #define SERVER_PORT   "3001"
    ```

    > **Finding your IP:** Run `ipconfig` in Command Prompt and look for the **IPv4 Address** under your WiFi adapter.

    Upload `ESP32_SAMPLE.ino` via Arduino IDE. The ESP32 posts to `/api/sensor-data`.

    ### ESP32 Single-Sensor Configuration (`ESP32_SINGLE_SENSOR`)

    `ESP32_SINGLE_SENSOR.ino` posts to `/api/bins/1/measurement` with:

    - `raw_distance_cm`
    - `compartment` (`dry` or `wet`)
    - Header: `X-Device-Key: <DEVICE_API_KEY>`

    Make sure `DEVICE_API_KEY` in the sketch matches `server/.env`.

    > **Upload tip:** If upload fails, hold the **BOOT** button on the ESP32 while the IDE shows `Connecting...`

    ---

    ## 🌐 API Reference

    ### Authentication (public — no token required)

    | Method | Path                 | Description                      |
    | ------ | -------------------- | -------------------------------- |
    | `POST` | `/api/auth/login`    | Login → returns JWT token        |
    | `POST` | `/api/auth/register` | Register new user → returns JWT  |
    | `POST` | `/api/sensor-data`   | Legacy dual-sensor ingest        |

    ### Protected endpoints (JWT or device key)

    Protected routes accept either:

    - `Authorization: Bearer <token>`
    - `X-Device-Key: <DEVICE_API_KEY>`

    | Method | Path                        | Description                       |
    | ------ | --------------------------- | --------------------------------- |
    | `GET`  | `/api/auth/me`              | Verify token, return user info    |
    | `GET`  | `/api/health`               | Health check                      |
    | `GET`  | `/api/bins`                 | All bins with current fill levels |
    | `GET`  | `/api/bins/:id`             | Single bin + last 50 measurements |
    | `GET`  | `/api/bins/:id/analytics`   | Daily fill-cycle chart data       |
    | `POST` | `/api/bins/:id/measurement` | New measurement (single compartment) |
    | `GET`  | `/api/export/excel`         | Excel export (IST timestamps + optional date range) |

    ### ESP32 → POST `/api/sensor-data`

    ```json
    { "sensor1": 12.5, "sensor2": 38.0 }
    ```

    `sensor1` → Dry Waste, `sensor2` → Wet Waste. Fill level is computed from `max_height_cm`.

    ### Single Compartment → POST `/api/bins/:id/measurement`

    ```json
    { "raw_distance_cm": 14.2, "compartment": "dry" }
    ```

    Alternative body:

    ```json
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

    ```json
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

    ## 🗄️ Database Management

    The SQLite database (`server/bins.db`) stores all measurements, fill cycle events, and user accounts.

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

    ---

    ## License

    MIT
