# Changelog

| Version | Date       | Type          | Summary                                                                                          |
| ------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------ |
| v2.4.2  | 2026-04-21 | 📝 Docs       | Documentation Overhaul: Modernized CONTRIBUTING.md with automated setup and UI tokens             |
| v2.4.1  | 2026-04-20 | ✨ Feature    | Default Bin Seeding: Ensures 1 dustbin exists on first run while supporting dynamic additions    |
| v2.4.0  | 2026-04-20 | 📊 Export     | Premium Reporting: Executive Summaries, predictive maintenance analytics, and date presets       |
| v2.3.1  | 2026-04-19 | 📝 Docs       | Updated License from MIT to Apache 2.0                                                           |
| v2.3.0  | 2026-04-19 | 🎨 UI         | "Frosted Control Room" glassmorphism overhaul and light theme elimination                        |
| v2.2.0  | 2026-04-19 | 🎨 UI         | Redesigned Utilization Score card, Export to Excel UI, and native dark-mode icon compatibility   |
| v2.1.0  | 2026-04-19 | ✨ Feature    | Dynamic dustbin management, contributing guidelines, and ESP32 codebase renaming                 |
| v2.0.0  | 2026-04-17 | 🚀 Update     | Core infrastructure revamp: automated setup scripts, auto-host detection, OTA monitor, licensing |
| v1.9.0  | 2026-04-15 | 🎨 UI         | Peak-hours heatmaps, dark-mode styling, Refactored Excel export, DB Purge & web OTA UI           |
| v1.8.0  | 2026-04-13 | 📝 Docs       | Comprehensive BinThere dashboard, server documentation, and v5.5 code context additions          |
| v1.7.0  | 2026-03-27 | ✨ Feature    | Local Python integration for ML image endpoint testing and serial monitor terminal improvements  |
| v1.6.0  | 2026-03-25 | 🤖 Hardware   | Hardware Pipeline v5 roll-out (Web UI, NVS, TOF & servo configuration refactoring)               |
| v1.5.0  | 2026-03-23 | 📊 Export     | Extensive Excel export reporting, UI implementation, and feature documentation set               |
| v1.4.0  | 2026-03-19 | 🚀 Launch     | Main backend API launch: authentication, real-time WebSocket layers, SQLite data storage         |
| v1.3.0  | 2026-03-15 | 🔧 Fix        | WebSocket dynamic host routing and Python dependency specification                               |
| v1.2.0  | 2026-02-24 | 🔒 Auth       | Platform login integration, token delivery, and fill level analytics aggregation                 |
| v1.1.0  | 2026-02-23 | 📊 Analytics  | Initial real-time chart implementations and local DB schema architecture set                     |
| v1.0.0  | 2026-02-17 | 🎉 Initialize | Initial project commit and baseline repository formatting                                        |

All notable changes to the BinThere Dashboard are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [v2.4.2] — 2026-04-21

### Summary

Complete overhaul of the project contribution guidelines to align with the v2.4+ infrastructure, including automated environment configuration, glassmorphism design tokens, and mandatory documentation protocols.

### Added

- **Modernized Contributing Guide**: Refactored `CONTRIBUTING.md` to prioritize the automated `npm run configure` setup workflow and codify the "Frosted Control Room" aesthetic as a technical requirement.
- **UI/UX Standards**: Explicitly defined HSL color tokens for Dry/Wet waste categories and implemented mandatory performance constraints for backdrop filters.
- **Documentation Enforcement**: Codified the **Automated Changelog Protocol** and mandatory `README.md` synchronization as part of the "Definition of Done" for all Pull Requests.

### Changed

- **Setup Workflow**: Replaced manual environment variable configuration and multi-directory `npm install` steps with centralized `install:all` and `configure` scripts.
- **Hardware Simulation Guide**: Integrated instructions for using `test-sensor.ps1` for local hardware logic verification without physical ESP32 modules.

---

## [v2.4.1] — 2026-04-20

### Summary

Introduced proactive database seeding for dustbins to ensure a seamless "Out of the Box" experience while maintaining full support for dynamic user additions and persistence.

### Added

- **Automatic Bin Seeding**: The backend now detects if the `bins` table is empty on startup and automatically initializes "Dustbin #001". This ensures the dashboard is never unexpectedly empty on first run.

### Changed

- **Dynamic Documentation**: Updated API documentation and internal comments to reflect the shift from a hardcoded single-bin assumption to a fully dynamic, persistent multi-bin architecture.

---

## [v2.4.0] — 2026-04-20

### Summary

Transformed the Excel export system into a premium executive reporting tool. This update introduces a full refactor to the `better-sqlite3` driver for performance, a multi-sheet reporting engine with KPI summaries, and a proactive maintenance forecasting system.

### Added

- **Executive Summary Sheet**: A high-fidelity overview sheet featuring three core KPIs (Active Bins, Avg Utilization, Effiency) and a highlighted **"Critical Action"** alert for peak utilization windows.
- **Maintenance Prediction Engine**: Introduced a dedicated forecasting sheet that calculates estimated **"Time to Full"** for all monitored bins based on real-time fill rates and delta growth.
- **Quick Date Presets**: Enhanced the frontend UX with one-tap presets for **"Today"**, **"Last 7 Days"**, and **"Last 30 Days"**, drastically reducing report configuration time.
- **Visual Intelligence**: Applied rich conditional formatting across the workbook, including status-aware cell highlighting (Red/Yellow/Green) and color-coded priority flags for maintenance staff.

### Changed

- **Database Architecture**: Fully refactored `server/exportRoutes.js` from legacy callback-only `sqlite3` to synchronous, high-performance `better-sqlite3`.
- **Formatting Overhaul**: Workbook now uses professional typography (Inter/Calibri), custom column widths, and semantic grouping for machine-readable yet human-friendly reports.
- **Frontend Persistence**: Export settings now provide visual range confirmation and temporary success/error feedback loops.

---

## [v2.3.1] — 2026-04-19

### Change

Change Usage License from MIT to Apache 2.0

## [v2.3.0] — 2026-04-19

### Summary

Major visual overhaul transitioning to a premium "Frosted Control Room" glassmorphism theme and consolidating the application into a single, high-fidelity dark-mode experience.

### Added

- Shipped **"Frosted Control Room"** glassmorphism theme with Apple-inspired frosted layers, subtle blurs, and refined border opacities.
- Unified glass tokens (`--glass-bg`, `--glass-blur`, `--glass-shadow`) across all dashboard surfaces for a professional, cohesive look.

### Changed

- **Theme Consolidation**: Completely eliminated the light theme option. The application is now exclusively dark-mode by design to maximize visual impact and readability.
- **Design System Refinement**: Replaced the 'Industrial Clean' / 'Utilitarian Glass' styles with a deeper, more refined frosted glass system. Removed all unnecessary neon glows and aggressive inset highlights.
- **Frontend Architecture**: Removed `darkMode` state logic, context providers, and toggle buttons from the application core to reduce bundle size and logic complexity.
- **Component Styling**: Updated `AnalyticsSection`, `PeakHoursHeatmap`, `SummaryStats`, and `ExportToExcel` to natively support the forced-glass theme without conditional overrides.
- **Sensor Simulation**: Re-wrote `test-sensor.ps1` incorporating `-BinId` parameters natively simulating measurements across the dynamic dustbin mapping.
- **Modularization**: Finalized the refactoring of `App.jsx` into modular domain-specific components.

### Accessibility & Performance

- Implemented global `prefers-reduced-motion` support restricting ping and pulse animation outputs.
- Applied strict `React.memo` and `useMemo` constraints isolating SVG path calculations for real-time WebSocket data.
- Optimized `backdrop-filter` rendering by disabling blurs on mobile devices (max-width: 640px) to ensure smooth 60fps performance.

---

## [v2.2.0] — 2026-04-19

### Summary

Extensive UI overhauls for the dashboard utility cards along with critical UX fixes addressing native dark-mode constraints across browsers.

### Changed

- Completely redesigned the **Utilization Score** card to feature a bold, animated circular progress SVG arc with dynamic color-coding (`green`/`amber`/`red`).
- Overhauled the **Export to Excel** UI replacing raw inputs with refined, glassmorphism-inspired constraints and modern interaction states (hover/disabled/loading transitions).

### Fixed

- Resolved an accessibility issue natively where standard HTML date picker calendars (`::-webkit-calendar-picker-indicator`) and select dropdowns were rendering as pitch black in dark mode. Forced optimal icon color inversion dynamically via explicit `color-scheme: dark;` property mapping.

---

## [v2.1.0] — 2026-04-19

### Summary

Introduced dynamic dustbin management, improved analytics UI controls, and finalized community contributing guidelines alongside code structure renaming.

### Added

- Added ability to natively add and delete bins dynamically from the frontend, linked directly to the database layer.
- Added UI controls for updating and selecting bin locations for analytics.
- Created `CONTRIBUTING.md` guidelines for open-source contributors.

### Changed

- Renamed the core ESP32 firmware folder for clarity (`Final_code` -> `ESP32_Code`).

---

## [v2.0.0] — 2026-04-17

### Summary

A massive developer experience and environment overhaul introducing automated local setups, auto-host resolutions, environmental file fixes, and OTA monitoring.

### Added

- Setup scripts `scripts/setup.js` and npm execution commands added to `package.json`.
- Missing frontend and backend `.env.example` configurations.
- MIT License injection into repository constraints.
- Formal `ota_check` and `serial_monitor` standalone HTML debugging tools and READMEs.

### Changed

- Replaced hard-coded host constraints via dynamic `window.location.hostname` detection resolving API/WS cross-network loading.
- Overhauled root `README.md` to reflect dynamic networking and automatic setup scripts.

---

## [v1.9.0] — 2026-04-15

### Summary

Analytics UI scaling for Peak Hours, dark-mode CSS refinement, comprehensive exporting upgrades via ExcelJS, and over-the-air firmware update support.

### Added

- Introduced "Peak Hours" visualization heatmap logic alongside strict dark-mode color mappings.
- Re-architected Excel Export capability integrating full data dumping (Peak Headers, Data formatting) via the backend API.
- Introduced Daily Data Purging logic.
- Over-the-air firmware architecture implemented with ElegantOTA built right into the frontend dashboard shell.

### Fixed

- Resolved float literal parsing logic in ESP32 ultrasonic C++ firmwares.
- Removed outdated examples to reduce repository clutter.

---

## [v1.8.0] — 2026-04-13

### Summary

Complete documentation sprint focused on onboarding.

### Added

- Full code explanations applied strictly via `BinThere_Dashboard_Code_Explained.md` and related context markdown artifacts.
- Removed legacy autogenerated footers from system documents for professionalism.

---

## [v1.7.0] — 2026-03-27

### Summary

Embedded Python functionality enabling ML image detection and testing pipelines alongside serial communication refinement for end-users.

### Added

- Built out serial communication terminal visuals enabling text customization and clean UI formatting (`monitor.html`).
- Implemented Python Flask endpoint testing enabling local model detection pipelines locally prior to cloud deployment.

### Changed

- Standardized parameter naming on scripts for explicit cross-parity between testing frameworks and cloud models.

---

## [v1.6.0] — 2026-03-25

### Summary

The complete v5 IoT pipeline roll-out onto the C++ hardware modules incorporating Web UI, Storage and Motor drivers.

### Added

- Finished `binthere_final_pipeline.ino` representing `ESP32 IoT pipeline v5`.

### Changed

- Re-factored core C++ configurations, Web-UI interactions on the hardware hotspot, Non-Volatile Storage (NVS) reads/writes, Time-of-Flight sensors, and servo motors.

---

## [v1.5.0] — 2026-03-23

### Summary

Backend data reporting implementation.

### Added

- Delivered extensive Excel Export backend endpoints.
- Front-end integration via the primary dashboard layout.
- Exhaustive feature documentation injected into `EXPORT_FEATURE_GUIDE.md`.

### Changed

- Redesigned `README.md` pin configurations and system descriptors to match export capabilities.

---

## [v1.4.0] — 2026-03-19

### Summary

Platform foundation deployment! Backend Node server, auth integrations, and hardware connectivity established.

### Added

- Built Node/Express server handling backend endpoints, hardware communication, and web clients.
- JWT and basic auth capabilities deployed via Bcrypt protocols.
- Real-time updates shipped using native WebSockets.
- ESP32 hardware bindings built explicitly querying single ultrasonic sensors.

---

## [v1.3.0] — 2026-03-15

### Summary

Networking patch improving dynamic WebSocket host configuration across the frontend to support internal routing out of Dev modes.

### Fixed

- Eliminated hardcoded `localhost:3001` WebSocket URIs in favor of flexible window location resolution.
- Updated ESP32 code base and built related Python dependency files `requirements.txt`.

---

## [v1.2.0] — 2026-02-24

### Summary

Security integrations covering user logins and protected metric routing.

### Added

- Delivered complete User Login integration and API Token provisioning.

### Changed

- Updated Analytics metrics to calculate "Average Fill Level" instead of "Maximum Fill Level".
- Pushed Auth Tokens forward against the `/api/analytics` fetches locking endpoints.

---

## [v1.1.0] — 2026-02-23

### Summary

Shift from conceptual local hardware to formal web-application charts and stateful datasets.

### Added

- Shipped initial Chart Analytics reacting dynamically to WebSocket datasets.
- Setup explicit `.db` SQLite tracking instead of volatile arrays.

### Changed

- Cleaned `.gitignore` logic blocking active `.db-wal` and sqlite footprints from committing.

---

## [v1.0.0] — 2026-02-17

### Summary

Initial BinThere ultrasonic tracking footprint.

### Added

- Project structured, Prettier formatted, and repository established.
