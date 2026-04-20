# Contributing to BinThere Dashboard

Thank you for your interest in contributing to **BinThere** — a real-time IoT smart bin monitoring dashboard! Contributions of all kinds are welcome: bug fixes, new features, documentation improvements, and hardware/firmware enhancements.

---

## 📁 Project Structure

```
BinThere-Dashboard/
├── client/          # React frontend (dashboard UI)
│   └── src/components/
│       ├── dashboard/   # Domain-specific components
│       ├── layout/      # Shell and navigation
│       ├── modals/      # Popups and history charts
│       └── ui/          # Generic glassmorphism atoms
├── server/          # Node.js backend (REST API + WebSocket)
├── ESP32_Code/      # Arduino/ESP32 firmware (Time-of-Flight + NVS)
├── python_scripts/  # Python utilities for ML testing
├── serial_monitor/  # Standalone serial debugging tool
├── ota_check/       # OTA update monitoring scripts
└── scripts/         # Automation (setup.js, etc.)
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.8+
- **Arduino IDE** or PlatformIO (for ESP32 firmware)
- Git

### Local Setup

1. **Fork** the repository and clone your fork:

   ```bash
   git clone https://github.com/<your-username>/BinThere-Dashboard.git
   cd BinThere-Dashboard
   ```

2. **Automated Configuration:**

   Run the setup script to install all dependencies (client & server) and initialize your environment variables automatically.

   ```bash
   npm run install:all
   npm run configure
   ```

   _Note: `npm run configure` will create your `.env` files and seed a default admin user and dustbin in the SQLite database._

3. **Run the development servers:**

   ```bash
   # Starts both frontend and backend concurrently
   npm run dev
   ```

---

## 🛠️ Ways to Contribute

### 🐛 Bug Reports

- Search [existing issues](https://github.com/Yash19815/BinThere-Dashboard/issues) before opening a new one.
- Include: OS, Node/Python version, steps to reproduce, expected vs. actual behavior, and screenshots/logs if possible.

### ✨ Feature Requests

- Open an issue with the label `enhancement`.
- Clearly describe the use case and why it benefits the project.

### 🔌 ESP32 Firmware

- Keep firmware code in `ESP32_Code/`.
- Test on actual hardware (ESP32 + HC-SR04 / IR sensors) before submitting.
- Follow the existing code style and comment sensor pin mappings clearly.

### 🖥️ Frontend (React & Design)

- **Aesthetic Direction**: All UI must follow the **"Frosted Control Room"** (Glassmorphism) theme. Avoid generic AI UI patterns.
- **Glass Tokens**: Use the provided design tokens exclusively:
  - `--glass-bg`: Translucent background.
  - `--glass-blur`: Backdrop filter blur (clamp to `20px`).
  - `--glass-border`: Subtle semi-transparent borders.
- **Waste Category Colors**:
  - **Dry**: Use HSL values for `#34d399` (Emerald).
  - **Wet**: Use HSL values for `#60a5fa` (Azure).
- **Performance**: Use `React.memo` for real-time SVG updates. Ensure blurs are disabled on mobile (`max-width: 640px`) to maintain 60fps.

### 🔧 Backend (Node.js & SQLite)

- **Storage**: We use **SQLite** with the `better-sqlite3` driver. Manual SQL migrations should be added to `server/schema.sql`.
- **Dynamic Bins**: Do not hardcode bin IDs. Use the dynamic `/api/bins` endpoint.
- **Security**: Hardware devices MUST use the `X-Device-Key` header for measurement POSTs.

### 🤖 ESP32 & Hardware Simulation

- **Firmware**: Keep core logic in `ESP32_Code/`. Use Time-of-Flight (TOF) sensor logic where possible.
- **Simulation**: Test your changes without hardware using the provided PowerShell simulating script:
  ```powershell
  ./python_scripts/test-sensor.ps1 -BinId 1 -Compartment dry -Level 75
  ```

---

## 🔀 Pull Request Process

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes**, keeping commits small and descriptive:

   ```
   feat: add real-time fill level alerts
   fix: correct HC-SR04 distance calculation
   docs: update ESP32 wiring diagram
   ```

3. **Test your changes** thoroughly (frontend, backend, or firmware as applicable).

4. **Push and open a Pull Request** against the `main` branch:
   - Reference any related issue: `Closes #42`
   - Describe what changed and why
   - Add screenshots for UI changes

5. Wait for review. A maintainer will review and may request changes.

---

## ✅ Code style & Documentation

| Area             | Convention                                                       |
| ---------------- | ---------------------------------------------------------------- |
| JavaScript/React | ESLint + Prettier (Standard: Frosted Glass UI)                   |
| Commit Messages  | [Conventional Commits](https://www.conventionalcommits.org/)     |
| **Changelog**    | **MANDATORY**: Update `CHANGELOG.md` for every single change.    |
| **README**       | **MANDATORY**: Sync `README.md` if setup or API surface changes. |

### 📊 Changelog Protocol

When updating `CHANGELOG.md`, follow the existing table format:

1. Increment **Version** (SemVer).
2. Category Emojis: 🎨 UI, ✨ Feature, 🔧 Fix, 🤖 Hardware, 📊 Export, 📝 Docs.
3. Add a detailed summary in the collapsible details section.

---

## 🔐 Security

Do **not** commit API keys, database files (`.db`), or secrets. The `.env` template is provided via `npm run configure`. If you discover a security vulnerability, please email the maintainer privately.

---

## 📜 License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers this project.

---

## 🙌 Thank You!

Every contribution, big or small, helps make BinThere better. Whether you're fixing a typo or adding a full new sensor integration — it's appreciated! 💚

```

```
