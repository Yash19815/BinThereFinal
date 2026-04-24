# Changelog

| Version | Date       | Type          | Summary                                                                                           |
| ------- | ---------- | ------------- | ------------------------------------------------------------------------------------------------- |
| v2.8.0  | 2026-04-24 | 🎨 UI         | Enhanced dropdown opacity and implemented click-outside-to-close behavior for Header navigation    |
| v2.7.0  | 2026-04-23 | 🔧 Fix         | Resolved Export API 404 and expanded UI visuals                                                   |
| v2.6.0  | 2026-04-23 | 🔧 Fix         | Logic Inversion: Small distance now maps to Empty; Restored Traffic Light (G/Y/R) visuals          |
| v2.5.2  | 2026-04-23 | 🎨 UI         | Color Refinement: Restored waste-type identity (Blue/Green) with status-aware alert transitions    |
| v2.5.1  | 2026-04-23 | 🪄 Magic      | High-Fidelity Visual Refinement: 3D glass cylinders, kinetic shimmer, and status-aware glow auras |
| v2.5.0  | 2026-04-23 | 🎨 UI         | Frosted Control Room: Redesigned dashboard hero, industrial bin cards, and sidebar export tool |
| v2.4.4  | 2026-04-23 | 🚀 Update     | Sequential Startup & Advanced Logging: Backend-first initialization and comprehensive event logs  |
| v2.4.3  | 2026-04-21 | 🎨 UI         | Premium Dialogs: Replaced browser alerts/prompts with a "Frosted Control Room" glassmorphic modal |
| v2.4.2  | 2026-04-21 | 📝 Docs       | Documentation Overhaul: Modernized CONTRIBUTING.md with automated setup and UI tokens             |
| v2.4.1  | 2026-04-20 | ✨ Feature    | Default Bin Seeding: Ensures 1 dustbin exists on first run while supporting dynamic additions     |
| v2.4.0  | 2026-04-20 | 📊 Export     | Premium Reporting: Executive Summaries, predictive maintenance analytics, and date presets        |
| v2.3.1  | 2026-04-19 | 📝 Docs       | Updated License from MIT to Apache 2.0                                                            |
| v2.3.0  | 2026-04-19 | 🎨 UI         | "Frosted Control Room" glassmorphism overhaul and light theme elimination                         |
| v2.2.0  | 2026-04-19 | 🎨 UI         | Redesigned Utilization Score card, Export to Excel UI, and native dark-mode icon compatibility    |
| v2.1.0  | 2026-04-19 | ✨ Feature    | Dynamic dustbin management, contributing guidelines, and ESP32 codebase renaming                  |
| v2.0.0  | 2026-04-17 | 🚀 Update     | Core infrastructure revamp: automated setup scripts, auto-host detection, OTA monitor, licensing  |
| v1.9.0  | 2026-04-15 | 🎨 UI         | Peak-hours heatmaps, dark-mode styling, Refactored Excel export, DB Purge & web OTA UI            |
| v1.8.0  | 2026-04-13 | 📝 Docs       | Comprehensive BinThere dashboard, server documentation, and v5.5 code context additions           |
| v1.7.0  | 2026-03-27 | ✨ Feature    | Local Python integration for ML image endpoint testing and serial monitor terminal improvements   |
| v1.6.0  | 2026-03-25 | 🤖 Hardware   | Hardware Pipeline v5 roll-out (Web UI, NVS, TOF & servo configuration refactoring)                |
| v1.5.0  | 2026-03-23 | 📊 Export     | Extensive Excel export reporting, UI implementation, and feature documentation set                |
| v1.4.0  | 2026-03-19 | 🚀 Launch     | Main backend API launch: authentication, real-time WebSocket layers, SQLite data storage          |
| v1.3.0  | 2026-03-15 | 🔧 Fix        | WebSocket dynamic host routing and Python dependency specification                                |
| v1.2.0  | 2026-02-24 | 🔒 Auth       | Platform login integration, token delivery, and fill level analytics aggregation                  |
| v1.1.0  | 2026-02-23 | 📊 Analytics  | Initial real-time chart implementations and local DB schema architecture set                      |
| v1.0.0  | 2026-02-17 | 🎉 Initialize | Initial project commit and baseline repository formatting                                         |

All notable changes to the BinThere Dashboard are documented here.
Versioning follows [Semantic Versioning](https://semver.org/).
Format follows [Keep a Changelog](https://keepachangelog.com/).


---

## [v2.8.0] — 2026-04-24
### Summary
Improved the usability and visual clarity of the header navigation by increasing the opacity of dropdown panels and implementing a smarter "click-outside" closure logic for the notification and profile menus.

### Changed
- **Dropdown Opacity**: Switched `.notif-dropdown` and `.profile-dropdown` to a **fully opaque** solid background (`var(--surface-solid)`) and removed all glassmorphism/backdrop-filter effects to maximize readability.
- **Auto-Close Logic**: Implemented a global document click listener in `Header.jsx` that automatically closes open dropdowns when a user clicks anywhere outside the menu boundaries.

### Added
- **Ref-Based Interaction**: Integrated `useRef` and `useEffect` hooks in the `Header` component to track dropdown boundaries and manage stateful menu transitions more reliably.

---

## [v2.7.0] — 2026-04-23
### Summary
Emergency patch to resolve Excel reporting connectivity and finalize industrial UI proportions, including a major redesign of the fleet analytics visualization.

### Fixed
- **Export API Connectivity**: Fixed `404 Not Found` error on Excel report generation by correcting the `apiBaseUrl` routing in `App.jsx`.
- **UI Proportions**: Increased `CompartmentPanel` fill-tube height to **160px** (from 110px) to enhance operational legibility and satisfy "industrial scale" requirements.
- **Chart Overshoot Clamping**: Fixed an issue where the smooth curve would "dip" into negative values when approaching 0% by clamping Bezier control points to the chart floor.

### Changed
- **Chart Card Layout**: Redesigned the `FleetUtilizationChart` to use a "fill-card" layout where the trend line occupies the full card width, with the circular KPI repositioned as a compact overlay in the top-right corner.

### Added
- **Visual Curve Refinement**: Upgraded `FleetUtilizationChart` with a cubic Bezier smoothing algorithm, replacing the polygonal line with a smooth, fluid trend line.

### Hardware
- **Sensor Calibration**: Verified the **25cm** bin height mapping where 2cm = Empty (8%) and 25cm = Full (100%), matching bottom-mount logic.

---

## [v2.6.0] — 2026-04-23
### Summary
Inverted the core sensor logic to align with specific hardware mounting configurations where a smaller distance measurement indicates an empty container. Additionally, restored the intuitive Traffic Light (Green-Yellow-Red) visual system and significantly increased the vertical scale of the compartment monitoring cards for better legibility.

### Added

- **Vertical Scaling**: Increased the height of the 3D glass fill tubes from **90px to 160px**, providing nearly double the vertical resolution for real-time monitoring.
- **Traffic Light Color Logic**: Restored the globally intuitive color hierarchy:
  - **Green**: Almost Empty (0-49%)
  - **Yellow**: Medium Fill (50-79%)
  - **Red**: High/Full Alert (80-100%)

### Changed

- **Distance Logic Inversion**: Refactored the `computeFillLevel` backend function to interpret smaller distances as **Empty** and larger distances as **Full**. This ensures compatibility with bottom-mounted sensors or inverted ultrasonic mapping.
- **Visual Consistency**: Synchronized the overall fleet efficiency bars to use the same Green-to-Red status progression.

---

## [v2.5.2] — 2026-04-23

### Summary

Refined the color logic of the industrial fill tubes to restore waste-type identity while maintaining critical alert visibility. This update ensures that "Dry" and "Wet" waste compartments are easily distinguishable by their original color schemes (Blue and Green) during normal operation, only transitioning to Red/Orange as they reach critical levels.

### Added

- **Waste-Type Color Restoration**: Re-implemented the project's original color signature: **Blue for Dry Waste** and **Green for Wet Waste**.
- **Synchronized Status Logic**: Fully aligned the CSS class names with the `themeUtils.js` logic (`low`, `medium`, `high`, `full`), ensuring perfect parity between data thresholds and visual states.

### Changed

- **Adaptive Alert Hierarchy**: Optimized the fill tube gradients to dynamically shift from type-specific colors to a universal **Red Alert** state once the fill level exceeds 95% (as defined by `ALERT_THRESHOLD`).
- **Enhanced Visual Telemetry**: The overall bin efficiency bar now utilizes a Blue-to-Red progression instead of a simple Green-to-Red, providing better distinction from individual Wet Waste indicators.

---

## [v2.5.1] — 2026-04-23

### Summary

Elevated the dustbin monitoring visuals to a "High-Fidelity" standard by implementing advanced CSS textures and micro-interactions. This update focuses on the "Fill Tube" and "Average Fill" indicators, transforming them from static bars into interactive, 3D industrial glass components.

### Added

- **High-Fidelity Glass Cylinder (v3)**: Overhauled the `CompartmentPanel` fill indicators with 3D radial shading, floating liquid surface reflections, and industrial tick marks to simulate precision laboratory equipment.
- **Kinetic Shimmer Spell**: Integrated a "magical" light sweep effect (`.glass-shimmer`) that periodically traverses the monitoring tubes, adding depth and a premium "active" feel.
- **Status-Aware Glow Auras**: The `BinCard` footer progress bar now features a dynamic neon glow that updates its color (Green/Yellow/Orange/Red) and intensity based on real-time fill metrics.

### Changed

- **Silky-Smooth Transitions**: Upgraded all fill-level animations to use a high-precision `cubic-bezier(0.34, 1.56, 0.64, 1)` easing, providing a responsive, spring-like physical reaction to data updates.
- **Industrial Scale Integration**: Added 5-point measurement ticks to the compartment visuals to improve data legibility and reinforce the utilitarian aesthetic.

---

## [v2.5.0] — 2026-04-23

### Summary

Successfully transitioned the platform to a premium "Frosted Control Room" aesthetic with a high-fidelity operational dashboard. This update introduces a restructured 2fr/1fr hero layout, advanced fleet-wide utilization analytics, an industrial redesign of bin monitoring cards, and a human-readable audit trail for enhanced operational transparency.

### Added

- **Fleet Utilization Analytics**: Integrated a new 7-day historical line chart that tracks aggregate fill levels across the entire bin network, enabling trend identification and capacity planning.
- **Industrial Bin Card Redesign**: Overhauled the `BinCard` and `CompartmentPanel` with a high-precision industrial aesthetic. Replaced all emojis with `lucide-react` iconography and introduced high-fidelity "Fill Tube" visuals for compartment monitoring.
- **Human-Readable Audit Logs**: Refactored the server logging engine to translate technical HTTP strings into plain-English event descriptions (e.g., "Infrastructure update: Registered a new waste container").
- **Premium Calendar Selection**: Integrated a custom-built, glassmorphic `CalendarPicker` for date selection in exports.
- **Range Metadata Endpoint**: Added `/api/export/metadata` to the backend for dynamic temporal validation.

### Changed

- **Dashboard Hero Redesign**: Overhauled the main layout into a professional **2fr/1fr grid**. The primary section features live fleet analytics, while the sidebar houses compact administrative tools and report generation.
- **Magnetic Action Controls**: Consolidated "Add Dustbin" and "Refresh" controls into high-impact, animated button states. `BinCard` actions (Edit/Delete) now utilize magnetic entry transitions and industrial iconography.
- **Export Sidebar Refactor**: Re-engineered the `ExportToExcel` component into a compact, vertical sidebar tool to optimize screen real estate and align with the industrial control aesthetic.
- **Smart Date Constraints**: Implemented frontend validation preventing exports beyond a 365-day window and restricting selections to actual database archive starts.

---

## [v2.4.4] — 2026-04-23


### Summary

Optimized the development workflow by enforcing a sequential startup sequence and implemented a comprehensive server-side logging engine. This ensures backend readiness before frontend connection attempts and provides high-resolution auditing for authentication and data export events.

### Added

- **Advanced Event Logging**: Implemented explicit log hooks for successful and failed login attempts, identified by username and role.
- **Export Auditing**: Heatmap exports now log the specific waste type (Dry/Wet) and Bin ID, while Excel reports log the requested date range.
- **Request Logger Middleware**: Integrated a global middleware for the Express backend that tracks every incoming request, including timestamp, user identity (if authenticated), method, path, and status code.

### Changed

- **Sequential Startup**: Updated `package.json` to utilize `wait-on`. The dashboard frontend now waits for the backend port (3001) to be active before initializing, eliminating "Connection Refused" errors on cold starts.
- **Package Infrastructure**: Integrated `wait-on` as a core development dependency.

---

## [v2.4.3] — 2026-04-21

### Summary

Successfully eliminated all legacy browser interaction popups (`window.prompt`, `window.alert`) in favor of a high-fidelity, custom-built modal system. This update solidifies the **"Frosted Control Room"** aesthetic by introducing kinetic glassmorphic dialogs for all administrative actions.

### Added

- **Kinetic Prompt Modal**: A reusable, multi-field modal component supporting "Spring" (elastic) entry transitions and deep backdrop blurs (20px).
- **Industrial Form Controls**: High-contrast glass inputs featuring gradient-aware focus states and semantic validation feedback.

### Changed

- **Unified Add-Bin Workflow**: Replaced sequential browser prompts for "Name" and "Location" with a single, professional two-field form modal.
- **Glassmorphic Standardization**: Applied rigorous glass tokens across all system overlays, ensuring consistent depth and translucency across the entire dashboard.

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
