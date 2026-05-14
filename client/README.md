# BinThere - Frontend Client

This directory contains the React 18 frontend for the BinThere dashboard. It utilizes Vite for lightning-fast build tooling and Vanilla CSS with modern design tokens to achieve a premium "Dark Glassmorphic" UI. The client communicates with the backend via REST APIs and WebSockets for real-time telemetry.

## Architecture & Technology Stack

- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Vanilla CSS (utilizing CSS variables for a consistent Glassmorphism theme)
- **Data Flow:** Axios for REST endpoints, native WebSockets for real-time sensor updates

## Environment Configuration

Environment variables are dynamically scaffolded by the `scripts/setup.cjs` script at the root level.
The `.env` file must contain:
- `VITE_API_URL`: The HTTP URL of the backend (e.g., `http://192.168.1.5:3001`).
- `VITE_WS_URL`: The WebSocket URL of the backend (e.g., `ws://192.168.1.5:3001`).

These variables allow devices on the same local network (like smartphones or tablets) to seamlessly connect to the backend server.

## Installation & Usage

1. **Install Dependencies:**
   Typically handled by the global `npm run configure` command at the project root. Manually:
   ```bash
   npm install
   ```

2. **Development Mode:**
   ```bash
   npm run dev
   ```
   The Vite dev server will start (usually on port 5173). It expects the backend server (`tcp:3001`) to be running.

3. **Production Build:**
   ```bash
   npm run build
   ```
   Outputs the optimized static assets to the `dist/` directory. This directory is targeted by the Electron packager for the desktop application wrapper.
