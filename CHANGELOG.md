# Changelog

| Version | Date       | Type           | Summary                                                                                          |
| ------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------ |
| v2.2.0  | 2026-04-19 | 🎨 UI          | Redesigned Utilization Score card, Export to Excel UI, and native dark-mode icon compatibility   |
| v2.1.0  | 2026-04-19 | ✨ Feature     | Dynamic dustbin management, contributing guidelines, and ESP32 codebase renaming                 |
| v2.0.0  | 2026-04-17 | 🚀 Update      | Core infrastructure revamp: automated setup scripts, auto-host detection, OTA monitor, licensing |
| v1.9.0  | 2026-04-15 | 🎨 UI          | Peak-hours heatmaps, dark-mode styling, Refactored Excel export, DB Purge & web OTA UI           |
| v1.8.0  | 2026-04-13 | 📝 Docs        | Comprehensive BinThere dashboard, server documentation, and v5.5 code context additions          |
| v1.7.0  | 2026-03-27 | ✨ Feature     | Local Python integration for ML image endpoint testing and serial monitor terminal improvements  |
| v1.6.0  | 2026-03-25 | 🤖 Hardware    | Hardware Pipeline v5 roll-out (Web UI, NVS, TOF & servo configuration refactoring)               |
| v1.5.0  | 2026-03-23 | 📊 Export      | Extensive Excel export reporting, UI implementation, and feature documentation set               |
| v1.4.0  | 2026-03-19 | 🚀 Launch      | Main backend API launch: authentication, real-time WebSocket layers, SQLite data storage         |
| v1.3.0  | 2026-03-15 | 🔧 Fix         | WebSocket dynamic host routing and Python dependency specification                               |
| v1.2.0  | 2026-02-24 | 🔒 Auth        | Platform login integration, token delivery, and fill level analytics aggregation                 |
| v1.1.0  | 2026-02-23 | 📊 Analytics   | Initial real-time chart implementations and local DB schema architecture set                     |
| v1.0.0  | 2026-02-17 | 🎉 Initialize  | Initial project commit and baseline repository formatting                                        |

All notable changes to the BinThere Dashboard are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).
Format follows [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

Changes that are complete but not yet deployed to production.

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
