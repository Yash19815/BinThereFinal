# ESP32 Ultrasonic Sensor Monitor

A real-time web application that displays ultrasonic sensor readings from an ESP32 WiFi module. Features a modern React frontend with WebSocket-based live updates and a Node.js backend for data processing.

## ✨ Features

- 🔄 **Real-time Updates**: WebSocket-based live sensor data streaming
- 🎨 **Modern UI**: Premium design with glassmorphism effects
- 📊 **Visual Indicators**: Color-coded distance alerts
  - 🟢 Green: Far (> 50cm)
  - 🟡 Yellow: Medium (20-50cm)
  - 🔴 Red: Close (< 20cm)
- 📜 **History Tracking**: Last 10 measurements displayed
- 🔌 **Auto-Reconnection**: Automatic WebSocket reconnection on connection loss
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🧪 **Testing Tools**: PowerShell script for testing without hardware

## 📁 Project Structure

```
demo-ultrasonic/
├── server/                  # Node.js Backend
│   ├── server.js           # Express + WebSocket server
│   ├── package.json        # Server dependencies
│   ├── .env.example        # Environment variables template
│   └── .env               # Environment configuration (create this)
│
├── client/                 # React Frontend
│   ├── src/
│   │   ├── App.jsx        # Main React component
│   │   ├── App.css        # Styling with glassmorphism
│   │   └── main.jsx       # Application entry point
│   ├── package.json       # Client dependencies
│   ├── vite.config.js     # Vite configuration
│   └── .env.example       # Frontend environment template
│
├── ESP32_SAMPLE.ino       # Arduino code for ESP32
├── config.h.example       # ESP32 configuration template
├── config.h              # ESP32 config (create from example)
├── test-sensor.ps1       # PowerShell test script
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Arduino IDE** (for ESP32 programming)
- **ESP32 Dev Board**
- **HC-SR04 Ultrasonic Sensor**

### 1. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create environment file (optional)
cp .env.example .env

# Start the server
npm start
```

Server will run on `http://localhost:3001`

**Environment Variables** (optional in `.env`):

```env
PORT=3001
```

### 2. Frontend Setup

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm run dev
```

React app will run on `http://localhost:5173`

### 3. ESP32 Hardware Setup

#### Wiring

Connect the HC-SR04 ultrasonic sensor to ESP32:

| HC-SR04 Pin | ESP32 Pin | Description  |
| ----------- | --------- | ------------ |
| VCC         | 5V        | Power supply |
| GND         | GND       | Ground       |
| Trig        | GPIO 5    | Trigger pin  |
| Echo        | GPIO 18   | Echo pin     |

#### Configuration

1. **Copy configuration template:**

   ```bash
   cp config.h.example config.h
   ```

2. **Edit `config.h` with your settings:**

   ```cpp
   // WiFi Credentials
   #define WIFI_SSID "Your_WiFi_Name"
   #define WIFI_PASSWORD "Your_WiFi_Password"

   // Server Configuration
   #define SERVER_IP "192.168.1.100"  // Your computer's IP
   #define SERVER_PORT "3001"
   ```

3. **Find your computer's IP address:**
   - **Windows**: Run `ipconfig` and look for "IPv4 Address"
   - **macOS/Linux**: Run `ifconfig` or `ip addr`

#### Upload to ESP32

1. Open `ESP32_SAMPLE.ino` in Arduino IDE
2. Install ESP32 board support (if not already installed)
3. Select your ESP32 board from Tools → Board
4. Select the correct COM port from Tools → Port
5. Click Upload
6. Open Serial Monitor (115200 baud) to see connection status

## API Endpoints

### POST /api/sensor-data

Receives sensor data from ESP32.

**Request:**

```json
{
  "distance": 25.5
}
```

**Response:**

```json
{
  "status": "success",
  "message": "Data received and broadcasted",
  "data": {
    "distance": 25.5,
    "timestamp": "2026-02-16T15:54:30.123Z"
  }
}
```

### GET /api/health

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "connectedClients": 1,
  "timestamp": "2026-02-16T15:54:30.123Z"
}
```

## WebSocket

**URL:** `ws://localhost:3001`

**Message Format:**

```json
{
  "distance": 25.5,
  "timestamp": "2026-02-16T15:54:30.123Z"
}
```

## 🧪 Testing Without ESP32

You can test the application without physical hardware using the included test script or manual API calls.

### Option 1: PowerShell Test Script (Windows)

The project includes a PowerShell script that simulates sensor data:

```bash
# Run from project root directory
.\test-sensor.ps1
```

This script will:

- Send random distance values (5-100 cm) every 2 seconds
- Display timestamped status messages
- Continue running until you press `Ctrl+C`

### Option 2: Manual Testing with curl

**Single test request:**

```bash
curl -X POST http://localhost:3001/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"distance": 30}'
```

**PowerShell (Windows):**

```powershell
Invoke-RestMethod -Uri http://localhost:3001/api/sensor-data `
  -Method POST `
  -Body '{"distance": 30}' `
  -ContentType "application/json"
```

### Option 3: Browser Testing

You can also test by opening your browser's developer console and running:

```javascript
fetch("http://localhost:3001/api/sensor-data", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ distance: 45 }),
})
  .then((res) => res.json())
  .then(console.log);
```

## 🔧 Troubleshooting

### Backend Issues

**Problem: Server won't start or port already in use**

- Check if another application is using port 3001
- Kill the process: `netstat -ano | findstr :3001` (Windows) or `lsof -ti:3001 | xargs kill` (macOS/Linux)
- Change the port in `server/.env` file

**Problem: ESP32 data not being received**

- Verify server is running: Open `http://localhost:3001/api/health`
- Check ESP32 serial monitor for error messages
- Confirm your computer's IP address hasn't changed
- Ensure firewall allows incoming connections on port 3001
- Try testing with curl/PowerShell script first

### Frontend Issues

**Problem: WebSocket not connecting**

- Open browser console (F12) and check for WebSocket errors
- Verify backend server is running on port 3001
- Check the WebSocket URL in the browser console
- Clear browser cache and reload

**Problem: No data updates**

- Ensure WebSocket connection is established (check connection status indicator)
- Verify backend is receiving data (check server terminal logs)
- Look for CORS errors in browser console

### ESP32 Issues

**Problem: WiFi connection fails**

- Verify SSID and password in `config.h` are correct
- Check if WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Ensure WiFi has good signal strength
- Check serial monitor for specific error messages

**Problem: Sensor readings inaccurate**

- Verify wiring connections are secure
- Check if sensor has 5V power supply
- Ensure there are no obstacles directly in front of sensor
- Verify pin definitions match your wiring (TRIG_PIN and ECHO_PIN)

**Problem: HTTP POST requests failing**

- Verify SERVER_IP in `config.h` matches your computer's current IP
- Check if both devices are on the same network
- Ensure backend server is running
- Try pinging your computer from another device on the network

## 📡 Architecture Overview

### Data Flow

```
ESP32 (Sensor) → HTTP POST → Node.js Server → WebSocket → React Frontend
     ↓                            ↓                            ↓
  Measures              Validates & Stores          Displays in UI
  Distance              Broadcasts to clients        Updates in real-time
```

### Communication

1. **ESP32 → Server**: HTTP POST requests with JSON payload
2. **Server → Frontend**: WebSocket for real-time updates
3. **Frontend ↔ Server**: HTTP for API requests, WebSocket for live data

## 🛠️ Development

### Running in Development Mode

All components support development mode with auto-reload:

**Backend:**

```bash
cd server
npm run dev
```

**Frontend:**

```bash
cd client
npm run dev
```

### Code Formatting

Both client and server include Prettier for code formatting:

```bash
# Format server code
cd server
npm run format

# Format client code
cd client
npm run format
```

### Building for Production

**Frontend:**

```bash
cd client
npm run build
# Build output will be in client/dist/
npm run preview  # Preview the production build
```

## 📋 Configuration Reference

### ESP32 Configuration (`config.h`)

| Setting         | Description                | Example           |
| --------------- | -------------------------- | ----------------- |
| `WIFI_SSID`     | WiFi network name          | `"MyHomeWiFi"`    |
| `WIFI_PASSWORD` | WiFi password              | `"mypassword123"` |
| `SERVER_IP`     | Computer's IP address      | `"192.168.1.100"` |
| `SERVER_PORT`   | Backend server port        | `"3001"`          |
| `TRIG_PIN`      | Ultrasonic trigger pin     | `5` (GPIO 5)      |
| `ECHO_PIN`      | Ultrasonic echo pin        | `18` (GPIO 18)    |
| `READ_INTERVAL` | Time between readings (ms) | `1000`            |

### Server Environment Variables (`.env`)

| Variable | Description        | Default |
| -------- | ------------------ | ------- |
| `PORT`   | Server port number | `3001`  |

## Technologies Used

- **Backend:** Node.js, Express, WebSocket (ws)
- **Frontend:** React, Vite
- **Hardware:** ESP32, HC-SR04 Ultrasonic Sensor
- **Communication:** HTTP POST, WebSocket

## License

MIT
