# BinThere - Utility Scripts

This directory houses cross-platform automation and configuration utilities used during the initialization, development, and packaging lifecycle of the BinThere project.

## Automation Tools

### `setup.cjs`

The primary initialization script. It automates the environment setup process across the entire monorepo, ensuring developers can clone and run the dashboard with zero manual configuration.

**Workflow:**
1. **Host Detection:** Dynamically detects the host machine's active local IP address (e.g., `192.168.1.5`) on the local network.
2. **Backend Config:** Scaffolds a `.env` file in the `server/` directory. It automatically generates a secure, randomized `JWT_SECRET` and provisions hardware API keys.
3. **Frontend Config:** Generates a matching `.env` file in the `client/` directory, exposing the network IP via `VITE_API_URL` and `VITE_WS_URL`. This guarantees that mobile devices and ESP32s on the same Wi-Fi network can seamlessly communicate with the backend.

**Usage:**
This script is automatically executed when you run the global configuration command from the project root:
```bash
npm run configure
```
