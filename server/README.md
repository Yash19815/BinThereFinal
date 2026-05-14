# BinThere - Backend Server

This directory contains the Node.js/Express backend that powers the BinThere ecosystem. It serves as the central hub, handling API requests from the React frontend, WebSocket synchronization with IoT devices, and high-performance SQLite database interactions.

## Architecture

- **Core Framework:** Node.js with Express.
- **Real-Time Layer:** `ws` (WebSockets) for bi-directional communication with the ESP32 and broadcasting updates to the React client.
- **Database:** `better-sqlite3` for synchronous, high-throughput SQLite operations.
- **Authentication:** JWT (JSON Web Tokens) for dashboard sessions, and API Keys for hardware endpoints.

## Database Management

The server uses a local SQLite database (`bins.db`).
- **Development Mode:** The database is created and stored in the `server/` directory.
- **Production Mode (Electron):** The path is overridden via the `PROD_DB_DIR` environment variable to write to the user's secure AppData directory (`AppData/Roaming/BinThere`), ensuring data persistence across app updates.

> [!TIP]
> **Native Dependency Compilation:** If you encounter `better-sqlite3` binding errors during Electron packaging, use the `npm run rebuild:sqlite` script from the project root. It rebuilds the native C++ bindings for the correct Electron ABI.

## Environment Variables

Configuration is driven via the `.env` file (generated automatically by `scripts/setup.cjs`). Key variables include:
- `PORT`: The API port (Default: 3001).
- `JWT_SECRET`: Secure session token key.
- `JWT_EXPIRES_IN`: Token validity duration.
- `DEVICE_API_KEY`: Hardware bypass key used by the ESP32 and Python scripts to push telemetry.
- `DEFAULT_ADMIN_USERNAME` / `DEFAULT_ADMIN_PASSWORD`: Credentials for the initial admin account seeding.

## Setup & Running

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Uses `nodemon` to automatically restart the server upon file modifications.
