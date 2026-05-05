/**
 * @fileoverview BinThere – Backend Server
 *
 * Express + WebSocket server that:
 * - Stores sensor readings in a SQLite database (better-sqlite3)
 * - Detects fill-cycle events (bin fills to ≥ FULL_THRESHOLD after being emptied)
 * - Pushes real-time updates to all connected WebSocket clients
 * - Exposes a REST API consumed by the React dashboard
 * - JWT-based authentication (login / register / me endpoints)
 * - Excel export functionality for all database data
 *
 * Environment variables (set in server/.env):
 * PORT                   – HTTP + WS port (default: 3001)
 * DB_PATH                – Absolute path to SQLite file
 * JWT_SECRET             – Secret key for signing JWTs
 * JWT_EXPIRES_IN         – Token lifetime (default: 7d)
 * DEFAULT_ADMIN_PASSWORD – Password for the seeded admin account
 *
 * Auth API surface:
 * POST /api/auth/register – Create a new user account
 * POST /api/auth/login    – Login and get a JWT
 * GET  /api/auth/me       – Verify token, return current user
 *
 * Protected API surface (requires Authorization: Bearer <token>):
 * GET  /api/health                    – Liveness probe
 * GET  /api/bins                      – All bins with latest compartment state
 * GET  /api/bins/:id                  – Single bin + last 50 measurements
 * GET  /api/bins/:id/analytics        – Daily fill-cycle counts (?range=7|14|30)
 * POST /api/bins/:id/measurement      – Record a reading for one compartment
 * POST /api/sensor-data               – Legacy dual-sensor endpoint
 * GET  /api/export/excel              – Export all data to Excel
 */

import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import exportRoutes from "./exportRoutes.js";

dotenv.config();

// ESM-compatible __dirname equivalent
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the SQLite database file. Overridable via DB_PATH env var. */
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bins.db");

// ── Database Setup ──────────────────────────────────────────────────────────

/**
 * Synchronous SQLite connection. better-sqlite3 uses blocking I/O which is
 * appropriate here — reads/writes are fast and never overlap with async code.
 */
const db = new Database(DB_PATH);

/**
 * Enable Write-Ahead Log mode.
 * WAL allows concurrent reads while a write is in progress, which prevents
 * "database is locked" errors when the dashboard and ESP32 hit the server
 * simultaneously.
 */
db.pragma("journal_mode = WAL");

/**
 * Bootstrap the schema on every startup (idempotent via IF NOT EXISTS).
 * Full schema with indexes lives in server/schema.sql for reference.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS bins (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    location    TEXT    NOT NULL,
    max_height_cm REAL  NOT NULL DEFAULT 25
  );

  CREATE TABLE IF NOT EXISTS measurements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id              INTEGER NOT NULL,
    compartment         TEXT    NOT NULL CHECK(compartment IN ('dry','wet')),
    raw_distance_cm     REAL    NOT NULL,
    fill_level_percent  REAL    NOT NULL,
    timestamp           TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS fill_cycles (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    bin_id        INTEGER NOT NULL,
    compartment   TEXT    NOT NULL CHECK(compartment IN ('dry','wet')),
    filled_at     TEXT    NOT NULL,
    emptied_at    TEXT,
    FOREIGN KEY (bin_id) REFERENCES bins(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Performance indexes to prevent full table scans on high-frequency queries
  CREATE INDEX IF NOT EXISTS idx_measurements_bin_comp_ts
    ON measurements(bin_id, compartment, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_measurements_timestamp
    ON measurements(timestamp);
  CREATE INDEX IF NOT EXISTS idx_fill_cycles_bin_comp
    ON fill_cycles(bin_id, compartment, filled_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fill_cycles_filled_at
    ON fill_cycles(filled_at);
`);

/** Seed a default admin user on first startup. */
const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

const existingAdmin = db.prepare("SELECT id FROM users WHERE username = ?").get(adminUsername);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(adminUsername, hash);
  console.log(`✅ Default admin user "${adminUsername}" created`);
}

// Ensure at least one bin exists by default on first run.
const binCount = db.prepare("SELECT COUNT(*) AS count FROM bins").get().count;
if (binCount === 0) {
  db.prepare("INSERT INTO bins (name, location, max_height_cm) VALUES (?, ?, ?)")
    .run("Dustbin #001", "Main Campus", 25);
  console.log("✅ Default dustbin created");
}

// ── JWT Helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function requireAuth(req, res, next) {
  const deviceKey = req.headers["x-device-key"];
  if (deviceKey) {
    if (deviceKey === process.env.DEVICE_API_KEY) {
      req.user = { sub: 0, username: "device", role: "device" };
      return next();
    }
    return res.status(401).json({ status: "error", message: "Unauthorized — invalid device key" });
  }

  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "Unauthorized — no token" });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ status: "error", message: "Unauthorized — invalid token" });
  }
}

// ── Fill-Cycle Detection ─────────────────────────────────────────────────────

const FULL_THRESHOLD = 60;
const EMPTY_THRESHOLD = 20;
const fillStateCache = new Map();

function getFillState(binId, compartment) {
  const key = `${binId}:${compartment}`;
  if (!fillStateCache.has(key)) {
    const last = db.prepare(`SELECT fill_level_percent FROM measurements WHERE bin_id=? AND compartment=? ORDER BY timestamp DESC LIMIT 1`).get(binId, compartment);
    const pct = last?.fill_level_percent ?? 0;
    fillStateCache.set(key, { wasFull: pct >= FULL_THRESHOLD, wasEmptied: pct < FULL_THRESHOLD });
  }
  return fillStateCache.get(key);
}

function recordFillCycle(binId, compartment, fillLevel, timestamp) {
  const state = getFillState(binId, compartment);

  if (!state.wasFull && fillLevel >= FULL_THRESHOLD && state.wasEmptied) {
    db.prepare(`INSERT INTO fill_cycles (bin_id, compartment, filled_at) VALUES (?, ?, ?)`).run(binId, compartment, timestamp);
    state.wasFull = true;
    state.wasEmptied = false;
    console.log(`🗑️  Fill event: bin ${binId} ${compartment} @ ${timestamp}`);
  } else if (state.wasFull && fillLevel < EMPTY_THRESHOLD) {
    db.prepare(`
      UPDATE fill_cycles SET emptied_at = ?
       WHERE id = (SELECT id FROM fill_cycles WHERE bin_id = ? AND compartment = ? AND emptied_at IS NULL ORDER BY id DESC LIMIT 1)
    `).run(timestamp, binId, compartment);
    state.wasFull = false;
    state.wasEmptied = true;
    console.log(`♻️  Empty event: bin ${binId} ${compartment} @ ${timestamp}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeFillLevel(rawDistanceCm, maxHeightCm) {
  // Small distance = bin is full (sensor at top, waste near sensor)
  // Large distance = bin is empty (sensor sees the bottom)
  const fill = ((maxHeightCm - rawDistanceCm) / maxHeightCm) * 100;
  return Math.min(100, Math.max(0, parseFloat(fill.toFixed(2))));
}

function computeStatus(fillPercent) {
  if (fillPercent < 10) return "Empty";
  if (fillPercent < 50) return "Low";
  if (fillPercent < 80) return "Medium";
  if (fillPercent < 95) return "High";
  return "Full";
}

/** Helper to format measurement for frontend consistency */
function formatMeasurement(m) {
  if (!m) return null;
  return {
    fill_level_percent: m.fill_level_percent,
    raw_distance_cm: m.raw_distance_cm,
    status: computeStatus(m.fill_level_percent),
    last_updated: m.timestamp,
  };
}

/**
 * Returns a complete bin response object with latest readings.
 * Still useful for O(1) single bin updates.
 */
function getBinWithCompartments(binId) {
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin) return null;

  const latestDry = db.prepare(`SELECT * FROM measurements WHERE bin_id = ? AND compartment = 'dry' ORDER BY timestamp DESC LIMIT 1`).get(binId);
  const latestWet = db.prepare(`SELECT * FROM measurements WHERE bin_id = ? AND compartment = 'wet' ORDER BY timestamp DESC LIMIT 1`).get(binId);

  return { 
    ...bin, 
    dry: formatMeasurement(latestDry), 
    wet: formatMeasurement(latestWet) 
  };
}

// ── Fleet State Cache ────────────────────────────────────────────────────────
// Keeps the full fleet state in memory so /api/bins and WS connections never
// need to run heavy GROUP BY aggregations. Invalidated on every mutation.

let fleetCache = null;

/**
 * Rebuilds the fleet cache from the database.
 * Called once at startup and after structural mutations (add/delete/edit bin).
 */
function rebuildFleetCache() {
  const bins = db.prepare("SELECT * FROM bins").all();

  const latestDry = db.prepare(`
    SELECT m.* FROM measurements m
    INNER JOIN (SELECT bin_id, MAX(timestamp) as max_ts FROM measurements WHERE compartment = 'dry' GROUP BY bin_id) latest
    ON m.bin_id = latest.bin_id AND m.timestamp = latest.max_ts AND m.compartment = 'dry'
  `).all();

  const latestWet = db.prepare(`
    SELECT m.* FROM measurements m
    INNER JOIN (SELECT bin_id, MAX(timestamp) as max_ts FROM measurements WHERE compartment = 'wet' GROUP BY bin_id) latest
    ON m.bin_id = latest.bin_id AND m.timestamp = latest.max_ts AND m.compartment = 'wet'
  `).all();

  const dryMap = new Map(latestDry.map(m => [m.bin_id, m]));
  const wetMap = new Map(latestWet.map(m => [m.bin_id, m]));

  fleetCache = bins.map(bin => ({
    ...bin,
    dry: formatMeasurement(dryMap.get(bin.id)),
    wet: formatMeasurement(wetMap.get(bin.id))
  }));
}

/**
 * Incrementally patches a single bin inside the cache after a new measurement.
 * Avoids a full rebuild for the most frequent write path.
 */
function patchFleetCache(binId) {
  if (!fleetCache) { rebuildFleetCache(); return; }
  const updated = getBinWithCompartments(binId);
  if (!updated) return;
  const idx = fleetCache.findIndex(b => b.id === binId);
  if (idx !== -1) fleetCache[idx] = updated;
  else fleetCache.push(updated);
}

/** Returns the cached fleet state, rebuilding if necessary. */
function getAllBinsWithCompartments() {
  if (!fleetCache) rebuildFleetCache();
  return fleetCache;
}

// Build the initial cache at startup
rebuildFleetCache();

// ── Express + WebSocket ──────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3001;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

app.use(cors());
app.use(express.json());

// ── Executive Human-Readable Logging ─────────────────────────────────────────

/** Defined outside middleware to prevent memory reallocation per request */
const LOG_ROUTES = [
  { pattern: /^\/api\/auth\/login$/, message: "Security: Authorized administrative session established" },
  { pattern: /^\/api\/auth\/register$/, message: "Access Control: Provisioned credentials for a new system operator" },
  { pattern: /^\/api\/auth\/me$/, message: "Identity Verification: Confirmed active session credentials" },
  { pattern: /^\/api\/bins$/, method: "GET", message: "Fleet Oversight: Retrieved real-time status for all deployed assets" },
  { pattern: /^\/api\/bins$/, method: "POST", message: "Infrastructure Expansion: Integrated a new unit into the active service fleet" },
  { pattern: /^\/api\/bins\/\d+$/, method: "DELETE", message: "Fleet Maintenance: Retired a service unit from the active registry" },
  { pattern: /^\/api\/bins\/\d+$/, method: "PATCH", message: "Optimization: Calibrated configuration settings for a specific asset" },
  { pattern: /^\/api\/analytics\/utilization$/, message: "Efficiency Audit: Evaluated current resource load across the network" },
  { pattern: /^\/api\/analytics\/fleet-history$/, message: "Performance Review: Compiled historical trends for the 7-day operational cycle" },
  { pattern: /^\/api\/analytics\/fleet-fill-cycles(\?.*)?$/, message: "Fleet Cycles: Aggregated total fill cycles across all bins" },
  { pattern: /^\/api\/bins\/\d+\/analytics$/, message: "Unit Analysis: Benchmarked efficiency metrics for a specific asset" },
  { pattern: /^\/api\/bins\/\d+\/heatmap$/, message: "Strategic Mapping: Visualized peak activity patterns and usage density" },
  { pattern: /^\/api\/bins\/\d+$/, method: "GET", message: "Data Inspection: Reviewed comprehensive historical logs for a specific unit" },
  { pattern: /^\/api\/bins\/\d+\/measurement$/, message: "Diagnostics: Validated real-time telemetry flow from remote hardware" },
  { pattern: /^\/api\/sensor-data$/, message: "System Feed: Processed automated data stream from the sensor network" },
  { pattern: /^\/api\/export\/excel(\?.*)?$/, message: "Reporting: Generated standardized audit document (Excel format)" },
  { pattern: /^\/api\/export\/metadata$/, message: "System Integrity: Verified availability of archival data for reporting" },
  { pattern: /^\/api\/logs\/event$/, message: "Audit Trail: Logged manual administrative interaction with the dashboard" },
];

const getHumanReadableLog = (method, url, statusCode) => {
  const match = LOG_ROUTES.find(r => r.pattern.test(url) && (!r.method || r.method === method));
  
  let statusContext = "✅ Success";
  if (statusCode >= 400 && statusCode < 500) statusContext = "⚠️ Denied";
  else if (statusCode >= 500) statusContext = "🛑 Error";

  return match ? `${statusContext} | ${match.message}` : `${statusContext} | Activity: ${method} ${url}`;
};

// ── Request Logger Middleware ────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on("finish", () => {
    const timestamp = toISTString();
    const identity = req.user ? `[${req.user.username}]` : "[Guest]";
    const action = getHumanReadableLog(req.method, req.originalUrl, res.statusCode);
    console.log(`[${timestamp}] ${identity} -> ${action}`);
  });
  next();
});

// ── Auth Routes ─────────────────────────────────────────────────────

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ status: "error", message: "required fields missing" });

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
  if (!user) return res.status(401).json({ status: "error", message: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ status: "error", message: "Invalid credentials" });

  res.json({ status: "success", token: signToken(user), user: { id: user.id, username: user.username, role: user.role } });
});

app.post("/api/auth/register", async (req, res) => {
  const { username, password, role = "user" } = req.body;
  if (!username || !password) return res.status(400).json({ status: "error", message: "required fields missing" });

  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
  if (existing) return res.status(409).json({ status: "error", message: "Username taken" });

  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(username, hash, role);
  const newUser = { id: info.lastInsertRowid, username, role };
  res.status(201).json({ status: "success", token: signToken(newUser), user: newUser });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, role FROM users WHERE id = ?").get(req.user.sub);
  user ? res.json({ status: "success", user }) : res.status(404).json({ status: "error", message: "User not found" });
});

// ── WebSocket ──────────────────────────────────────────────────────

wss.on("connection", (ws) => {
  clients.add(ws);
  // Optimized multi-bin fetch
  getAllBinsWithCompartments().forEach(bin => ws.send(JSON.stringify({ type: "state", bin })));
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) { if (ws.readyState === 1) ws.send(msg); }
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/health", requireAuth, (req, res) => {
  res.json({ status: "ok", connectedClients: clients.size, timestamp: new Date().toISOString() });
});

app.get("/api/bins", requireAuth, (req, res) => {
  res.json({ status: "success", bins: getAllBinsWithCompartments() });
});

app.post("/api/bins", requireAuth, (req, res) => {
  const { name, location, max_height_cm = 25 } = req.body;
  if (!name || !location) return res.status(400).json({ status: "error", message: "Name and location required" });

  const result = db.prepare("INSERT INTO bins (name, location, max_height_cm) VALUES (?, ?, ?)").run(name.trim(), location.trim(), max_height_cm);
  const newBin = getBinWithCompartments(result.lastInsertRowid);
  rebuildFleetCache();
  broadcast({ type: "new", bin: newBin });
  res.status(201).json({ status: "success", bin: newBin });
});

app.get("/api/bins/:id", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin) return res.status(404).json({ status: "error", message: "Bin not found" });

  const history = db.prepare(`
    SELECT compartment, raw_distance_cm, fill_level_percent, timestamp
    FROM measurements
    WHERE bin_id = ?
    ORDER BY timestamp DESC
    LIMIT 50
  `).all(binId);

  res.json({ status: "success", bin, history });
});

app.delete("/api/bins/:id", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  if (!db.prepare("SELECT 1 FROM bins WHERE id = ?").get(binId)) return res.status(404).json({ status: "error", message: "Bin not found" });

  db.transaction(() => {
    db.prepare("DELETE FROM measurements WHERE bin_id = ?").run(binId);
    db.prepare("DELETE FROM fill_cycles WHERE bin_id = ?").run(binId);
    db.prepare("DELETE FROM bins WHERE id = ?").run(binId);
  })();

  rebuildFleetCache();
  fillStateCache.delete(`${binId}:dry`);
  fillStateCache.delete(`${binId}:wet`);
  broadcast({ type: "delete", binId });
  res.json({ status: "success", message: "Bin deleted" });
});

app.patch("/api/bins/:id", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const { location } = req.body;
  if (typeof location !== "string" || !location.trim()) return res.status(400).json({ status: "error", message: "Location required" });

  const result = db.prepare("UPDATE bins SET location = ? WHERE id = ?").run(location.trim(), binId);
  if (result.changes === 0) return res.status(404).json({ status: "error", message: "Bin not found" });

  const updatedBin = getBinWithCompartments(binId);
  patchFleetCache(binId);
  broadcast({ type: "update", bin: updatedBin });
  res.json({ status: "success", bin: updatedBin });
});

/** Analytics and other routes continue using the same logic but with restored comments... */
app.get("/api/analytics/utilization", requireAuth, (req, res) => {
  const row = db.prepare(`SELECT AVG(fill_level_percent) as avgFill FROM measurements WHERE timestamp >= datetime('now', '-24 hours')`).get();
  res.json({ status: "success", utilization_score: row?.avgFill != null ? Math.round(row.avgFill) : 0 });
});

/**
 * GET /api/analytics/fleet-history
 * Returns 7-day daily average fill levels across all bins for the Fleet Utilization chart.
 */
app.get("/api/analytics/fleet-history", requireAuth, (req, res) => {
  const days = 7;
  const allDays = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10);
  });

  const rows = db.prepare(`
    SELECT date(timestamp) AS day, AVG(fill_level_percent) AS avgFill
    FROM measurements
    WHERE timestamp >= datetime('now', ? || ' days')
    GROUP BY day
    ORDER BY day
  `).all(`-${days}`);

  const dayMap = {};
  rows.forEach(r => { dayMap[r.day] = Math.round(r.avgFill); });

  res.json({
    status: "success",
    labels: allDays.map(d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })),
    points: allDays.map(d => dayMap[d] ?? 0),
  });
});

app.get("/api/analytics/fleet-fill-cycles", requireAuth, (req, res) => {
  const days = Math.min(parseInt(req.query.range || "7", 10), 90);
  const allDays = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10);
  });
  const rows = db.prepare(`
    SELECT date(filled_at) AS day, compartment, COUNT(*) AS cnt
    FROM fill_cycles
    WHERE filled_at >= datetime('now', ? || ' days')
    GROUP BY day, compartment
  `).all(`-${days}`);
  const dryMap = {}, wetMap = {};
  rows.forEach(r => {
    if (r.compartment === "dry") dryMap[r.day] = r.cnt;
    if (r.compartment === "wet") wetMap[r.day] = r.cnt;
  });
  res.json({
    status: "success",
    labels: allDays.map(d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })),
    dry: allDays.map(d => dryMap[d] ?? 0),
    wet: allDays.map(d => wetMap[d] ?? 0),
    latest: {
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      dry: dryMap[new Date().toISOString().slice(0, 10)] ?? 0,
      wet: wetMap[new Date().toISOString().slice(0, 10)] ?? 0,
    },
  });
});

app.get("/api/bins/:id/analytics", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  if (!db.prepare("SELECT 1 FROM bins WHERE id = ?").get(binId)) return res.status(404).json({ status: "error", message: "Bin not found" });

  const days = Math.min(parseInt(req.query.range || "7", 10), 90);
  const allDays = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10);
  });

  const rows = db.prepare(`SELECT date(filled_at) AS day, compartment, COUNT(*) AS cnt FROM fill_cycles WHERE bin_id = ? AND filled_at >= datetime('now', ? || ' days') GROUP BY day, compartment`).all(binId, `-${days}`);

  const dryMap = {}, wetMap = {};
  rows.forEach(r => { if (r.compartment === "dry") dryMap[r.day] = r.cnt; if (r.compartment === "wet") wetMap[r.day] = r.cnt; });

  res.json({
    status: "success",
    labels: allDays.map(d => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })),
    dry: allDays.map(d => dryMap[d] ?? 0),
    wet: allDays.map(d => wetMap[d] ?? 0),
    latest: {
      date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      dry: dryMap[new Date().toISOString().slice(0, 10)] ?? 0,
      wet: wetMap[new Date().toISOString().slice(0, 10)] ?? 0,
    },
  });
});

app.post("/api/bins/:id/measurement", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin) return res.status(404).json({ status: "error", message: "Bin not found" });

  const { raw_distance_cm, fill_level_percent, compartment = "dry" } = req.body;
  let fillLevel, rawDistance;

  if (raw_distance_cm !== undefined) {
    rawDistance = parseFloat(raw_distance_cm);
    if (isNaN(rawDistance) || rawDistance < 0) return res.status(400).json({ status: "error", message: "Invalid raw_distance_cm — must be a non-negative number" });
    fillLevel = computeFillLevel(rawDistance, bin.max_height_cm);
  } else if (fill_level_percent !== undefined) {
    fillLevel = parseFloat(fill_level_percent);
    if (isNaN(fillLevel)) return res.status(400).json({ status: "error", message: "Invalid fill_level_percent — must be a number" });
    fillLevel = Math.min(100, Math.max(0, fillLevel));
    rawDistance = parseFloat(((1 - fillLevel / 100) * bin.max_height_cm).toFixed(2));
  } else return res.status(400).json({ status: "error", message: "No data provided" });

  const timestamp = new Date().toISOString();
  db.prepare(`INSERT INTO measurements (bin_id, compartment, raw_distance_cm, fill_level_percent, timestamp) VALUES (?, ?, ?, ?, ?)`).run(binId, compartment, rawDistance, fillLevel, timestamp);
  
  recordFillCycle(binId, compartment, fillLevel, timestamp);
  patchFleetCache(binId);
  // Use the already-patched cache entry to avoid a redundant DB query
  const cachedBin = fleetCache?.find(b => b.id === binId);
  broadcast({ type: "update", bin: cachedBin || getBinWithCompartments(binId) });

  res.json({ status: "success", data: { bin_id: binId, compartment, fill_level_percent: fillLevel, timestamp } });
});

/**
 * GET /api/bins/:id/heatmap
 * Returns 24x7 activity density (avg fill cycles per week) for a specific bin.
 */
app.get("/api/bins/:id/heatmap", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const compartment = req.query.compartment; // optional: 'dry' | 'wet'

  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin) return res.status(404).json({ status: "error", message: "Bin not found" });

  let query = "SELECT filled_at FROM fill_cycles WHERE bin_id = ?";
  const params = [binId];
  if (compartment === "dry" || compartment === "wet") {
    query += " AND compartment = ?";
    params.push(compartment);
  }
  query += " ORDER BY filled_at ASC";

  const rows = db.prepare(query).all(...params);

  // Calculate total weeks covered
  let weeks = 1;
  if (rows.length > 0) {
    const start = new Date(rows[0].filled_at);
    const end = new Date();
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    weeks = Math.max(1, Math.ceil(diffDays / 7));
  }

  // Initialize 7x24 matrix
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  
  rows.forEach(r => {
    const d = new Date(r.filled_at);
    // (d.getDay() + 6) % 7 maps Sunday(0)->6, Monday(1)->0 ... Saturday(6)->5
    // But PeakHoursHeatmap.jsx defines DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    // So Monday is 0. getDay() is Sun(0), Mon(1)...
    const dayIdx = (d.getDay() + 6) % 7; 
    const hrIdx = d.getHours();
    matrix[dayIdx][hrIdx]++;
  });

  // Calculate averages and find max
  let max = 0;
  const data = matrix.map(row => 
    row.map(val => {
      const avg = val / weeks;
      if (avg > max) max = avg;
      return avg;
    })
  );

  res.json({ status: "success", data, max, weeks });
});

// Excel export routes
app.use("/api", exportRoutes);

const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`✅ Server running at http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket ready at ws://${HOST}:${PORT}`);
});

function toISTString(date = new Date()) {
  return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false }) + " IST";
}

/**
 * Batched purge to avoid blocking the event loop with a single massive DELETE.
 * Deletes up to BATCH_SIZE rows per tick, then yields to the event loop.
 */
const PURGE_BATCH_SIZE = 500;

function purgeOldData() {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  const deleteMeasurements = db.prepare(
    `DELETE FROM measurements WHERE id IN (SELECT id FROM measurements WHERE timestamp < ? LIMIT ${PURGE_BATCH_SIZE})`
  );
  const deleteFillCycles = db.prepare(
    `DELETE FROM fill_cycles WHERE id IN (SELECT id FROM fill_cycles WHERE filled_at < ? LIMIT ${PURGE_BATCH_SIZE})`
  );

  let totalDeleted = 0;
  function purgeBatch() {
    let deleted = 0;
    deleted += deleteMeasurements.run(cutoff).changes;
    deleted += deleteFillCycles.run(cutoff).changes;

    if (deleted > 0) {
      totalDeleted += deleted;
      // Yield to the event loop before the next batch
      setTimeout(purgeBatch, 50);
    } else {
      // Only VACUUM if rows were actually removed — avoids locking the DB for nothing
      if (totalDeleted > 0) {
        console.log(`🧹 Purge complete — ${totalDeleted} rows removed, running VACUUM`);
        db.exec("VACUUM");
        rebuildFleetCache();
      } else {
        console.log("🧹 Purge check — no stale data found");
      }
    }
  }

  purgeBatch();
}

function scheduleDailyPurge() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  setTimeout(() => { purgeOldData(); scheduleDailyPurge(); }, nextMidnight - now);
}

purgeOldData();
scheduleDailyPurge();