/**
 * @fileoverview BinThere – Backend Server
 *
 * Express + WebSocket server that:
 *  - Stores sensor readings in a SQLite database (better-sqlite3)
 *  - Detects fill-cycle events (bin fills to ≥ FULL_THRESHOLD after being emptied)
 *  - Pushes real-time updates to all connected WebSocket clients
 *  - Exposes a REST API consumed by the React dashboard
 *  - JWT-based authentication (login / register / me endpoints)
 *
 * Environment variables (set in server/.env):
 *  PORT                   – HTTP + WS port (default: 3001)
 *  DB_PATH                – Absolute path to SQLite file
 *  JWT_SECRET             – Secret key for signing JWTs
 *  JWT_EXPIRES_IN         – Token lifetime (default: 7d)
 *  DEFAULT_ADMIN_PASSWORD – Password for the seeded admin account
 *
 * Auth API surface:
 *  POST /api/auth/register – Create a new user account
 *  POST /api/auth/login    – Login and get a JWT
 *  GET  /api/auth/me       – Verify token, return current user
 *
 * Protected API surface (requires Authorization: Bearer <token>):
 *  GET  /api/health                    – Liveness probe
 *  GET  /api/bins                      – All bins with latest compartment state
 *  GET  /api/bins/:id                  – Single bin + last 50 measurements
 *  GET  /api/bins/:id/analytics        – Daily fill-cycle counts (?range=7|14|30)
 *  POST /api/bins/:id/measurement      – Record a reading for one compartment
 *  POST /api/sensor-data               – Legacy dual-sensor endpoint
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
 *
 * Tables:
 *  bins         – One row per physical dustbin unit
 *  measurements – Every raw sensor reading from the ESP32
 *  fill_cycles  – One row per detected fill event (see recordFillCycle)
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
`);

/** Ensure default Bin #1 exists so the dashboard has something to display. */
const seedBin = db.prepare(
  "INSERT OR IGNORE INTO bins (id, name, location, max_height_cm) VALUES (?, ?, ?, ?)",
);
seedBin.run(1, "Dustbin #001", "Main Campus", 25);

/**
 * Seed a default admin user on first startup.
 * Username and password are taken from env vars so they can be overridden
 * without modifying code. The password is always stored as a bcrypt hash.
 */
const adminUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin123";

const existingAdmin = db
  .prepare("SELECT id FROM users WHERE username = ?")
  .get(adminUsername);

if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')",
  ).run(adminUsername, hash);
  console.log(`✅ Default admin user "${adminUsername}" created`);
}

// ── JWT Helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

/**
 * Signs a JWT payload for a given user.
 *
 * @param {{ id: number, username: string, role: string }} user
 * @returns {string} Signed JWT token string
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/**
 * Express middleware that validates incoming requests from either:
 *  a) A browser dashboard user   → `Authorization: Bearer <jwt>`
 *  b) A hardware device (ESP32)  → `X-Device-Key: <static-key>`
 *
 * Attaches `req.user` when a JWT is verified.
 * Returns HTTP 401 if neither credential is valid.
 */
function requireAuth(req, res, next) {
  // ── Device key fast-path (ESP32, Python scripts, etc.) ──────────────────
  const deviceKey = req.headers["x-device-key"];
  if (deviceKey) {
    if (deviceKey === process.env.DEVICE_API_KEY) {
      req.user = { sub: 0, username: "device", role: "device" };
      return next();
    }
    return res
      .status(401)
      .json({ status: "error", message: "Unauthorized — invalid device key" });
  }

  // ── JWT path (browser dashboard) ─────────────────────────────────────────
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ status: "error", message: "Unauthorized — no token" });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res
      .status(401)
      .json({ status: "error", message: "Unauthorized — invalid token" });
  }
}

// ── Fill-Cycle Detection ─────────────────────────────────────────────────────

/**
 * Fill level at which a "full" event is recorded (0–100 %).
 * Derived from alert distance: ((maxHeight − alertDist) / maxHeight) × 100
 * = ((25 − 10) / 25) × 100 = 60 %
 * A bin must rise ABOVE this value coming from a post-empty state.
 */
const FULL_THRESHOLD = 60;

/**
 * Fill level below which a bin is considered "emptied".
 * The bin must drop below this after being full before the next fill is counted,
 * preventing double-counting if the level fluctuates near FULL_THRESHOLD.
 */
const EMPTY_THRESHOLD = 20;

/**
 * In-memory fill state cache keyed by "${binId}:${compartment}".
 * Lazy-initialised from the last DB reading the first time a compartment is seen.
 * Avoids repeated DB queries on every sensor reading.
 *
 * Each entry: { wasFull: boolean, wasEmptied: boolean }
 */
const fillStateCache = new Map();

/**
 * Returns (and lazily initialises) the fill-state entry for a compartment.
 *
 * Initialisation rule:
 *  - If last reading ≥ FULL_THRESHOLD → wasFull=true,  wasEmptied=false
 *  - If last reading < FULL_THRESHOLD → wasFull=false, wasEmptied=true
 *
 * Using < FULL_THRESHOLD (not < EMPTY_THRESHOLD) for wasEmptied avoids the
 * "permanently stuck" bug where bins with mid-range readings (e.g. 50 %) would
 * never have wasEmptied=true and therefore never count a future fill event.
 *
 * @param {number} binId       - Database bin ID
 * @param {string} compartment - "dry" | "wet"
 * @returns {{ wasFull: boolean, wasEmptied: boolean }}
 */
function getFillState(binId, compartment) {
  const key = `${binId}:${compartment}`;
  if (!fillStateCache.has(key)) {
    const last = db
      .prepare(
        `SELECT fill_level_percent FROM measurements
       WHERE bin_id=? AND compartment=? ORDER BY timestamp DESC LIMIT 1`,
      )
      .get(binId, compartment);
    const pct = last?.fill_level_percent ?? 0;
    fillStateCache.set(key, {
      wasFull: pct >= FULL_THRESHOLD,
      // Any reading below Full means the bin is not currently full,
      // so treat it as "ready to count the next fill event".
      // (Using < EMPTY_THRESHOLD caused bins at 20-94% to get permanently stuck.)
      wasEmptied: pct < FULL_THRESHOLD,
    });
  }
  return fillStateCache.get(key);
}

/**
 * Detects fill/empty transitions and persists them to the fill_cycles table.
 *
 * State machine (per compartment):
 *
 *   wasEmptied=true + level ≥ FULL_THRESHOLD
 *     → INSERT fill_cycles row, set wasFull=true, wasEmptied=false
 *
 *   wasFull=true + level < EMPTY_THRESHOLD
 *     → UPDATE most-recent open fill_cycles row with emptied_at,
 *       set wasFull=false, wasEmptied=true
 *
 * Must be called AFTER the measurement row is already inserted so the DB is
 * always consistent (measurement exists before its derived fill event).
 *
 * @param {number} binId       - Database bin ID
 * @param {string} compartment - "dry" | "wet"
 * @param {number} fillLevel   - Current fill level 0–100 %
 * @param {string} timestamp   - ISO-8601 timestamp string
 */
function recordFillCycle(binId, compartment, fillLevel, timestamp) {
  const state = getFillState(binId, compartment);

  if (!state.wasFull && fillLevel >= FULL_THRESHOLD && state.wasEmptied) {
    // ─ Rising edge into Full → record a fill event
    db.prepare(
      `INSERT INTO fill_cycles (bin_id, compartment, filled_at) VALUES (?, ?, ?)`,
    ).run(binId, compartment, timestamp);
    state.wasFull = true;
    state.wasEmptied = false;
    console.log(`🗑️  Fill event: bin ${binId} ${compartment} @ ${timestamp}`);
  } else if (state.wasFull && fillLevel < EMPTY_THRESHOLD) {
    // ─ Bin emptied → mark the open cycle as closed
    db.prepare(
      `UPDATE fill_cycles SET emptied_at = ?
       WHERE id = (
         SELECT id FROM fill_cycles
         WHERE bin_id = ? AND compartment = ? AND emptied_at IS NULL
         ORDER BY id DESC LIMIT 1
       )`,
    ).run(timestamp, binId, compartment);
    state.wasFull = false;
    state.wasEmptied = true;
    console.log(`♻️  Empty event: bin ${binId} ${compartment} @ ${timestamp}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converts an HC-SR04 raw distance reading into a 0–100 % fill level.
 *
 * Formula: ((maxHeight − distance) / maxHeight) × 100
 * When the bin is empty the sensor reads ≈ maxHeight (full distance to bottom).
 * When full the reading is near 0 (lid-level echo).
 * Result is clamped to [0, 100] to handle out-of-range sensor noise.
 *
 * @param {number} rawDistanceCm - HC-SR04 reading in centimetres
 * @param {number} maxHeightCm   - Empty-bin height stored in bins.max_height_cm
 * @returns {number} Fill percentage rounded to 2 decimal places
 */
function computeFillLevel(rawDistanceCm, maxHeightCm) {
  const fill = ((maxHeightCm - rawDistanceCm) / maxHeightCm) * 100;
  return Math.min(100, Math.max(0, parseFloat(fill.toFixed(2))));
}

/**
 * Maps a fill percentage to a human-readable status label shown on the dashboard.
 *
 * Thresholds:
 *  < 10 % → "Empty"
 *  < 50 % → "Low"
 *  < 80 % → "Medium"
 *  < 95 % → "High"
 *  ≥ 95 % → "Full"
 *
 * @param {number} fillPercent - 0–100 %
 * @returns {"Empty"|"Low"|"Medium"|"High"|"Full"}
 */
function computeStatus(fillPercent) {
  if (fillPercent < 10) return "Empty";
  if (fillPercent < 50) return "Low";
  if (fillPercent < 80) return "Medium";
  if (fillPercent < 95) return "High";
  return "Full";
}

/**
 * Assembles a complete bin response object with the latest reading for each
 * compartment (dry and wet), suitable for broadcasting over WebSocket or
 * returning as an API response.
 *
 * @param {number} binId - Database bin ID
 * @returns {{ id, name, location, max_height_cm, dry: object|null, wet: object|null } | null}
 *   null if the bin does not exist in the database.
 */
function getBinWithCompartments(binId) {
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin) return null;

  const latestDry = db
    .prepare(
      `
    SELECT * FROM measurements WHERE bin_id = ? AND compartment = 'dry'
    ORDER BY timestamp DESC LIMIT 1
  `,
    )
    .get(binId);

  const latestWet = db
    .prepare(
      `
    SELECT * FROM measurements WHERE bin_id = ? AND compartment = 'wet'
    ORDER BY timestamp DESC LIMIT 1
  `,
    )
    .get(binId);

  return {
    id: bin.id,
    name: bin.name,
    location: bin.location,
    max_height_cm: bin.max_height_cm,
    dry: latestDry
      ? {
          fill_level_percent: latestDry.fill_level_percent,
          raw_distance_cm: latestDry.raw_distance_cm,
          status: computeStatus(latestDry.fill_level_percent),
          last_updated: latestDry.timestamp,
        }
      : null,
    wet: latestWet
      ? {
          fill_level_percent: latestWet.fill_level_percent,
          raw_distance_cm: latestWet.raw_distance_cm,
          status: computeStatus(latestWet.fill_level_percent),
          last_updated: latestWet.timestamp,
        }
      : null,
  };
}

// ── Express + WebSocket ──────────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT || 3001;

/** Shared HTTP server so Express and WebSocket listen on the same port. */
const server = http.createServer(app);

/** WebSocket server attached to the HTTP server. */
const wss = new WebSocketServer({ server });

/** Set of all currently connected WebSocket clients. */
const clients = new Set();

app.use(cors());
app.use(express.json());

// ── Auth Routes (public) ─────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Verifies credentials and returns a signed JWT on success.
 *
 * Body: { username: string, password: string }
 * Returns: { status, token, user: { id, username, role } }
 */
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "username and password are required" });
  }

  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res
      .status(401)
      .json({ status: "error", message: "Invalid credentials" });
  }

  const token = signToken(user);
  res.json({
    status: "success",
    token,
    user: { id: user.id, username: user.username, role: user.role },
  });
});

/**
 * POST /api/auth/register
 * Creates a new user account (admin-only in production; open here for dev).
 *
 * Body: { username: string, password: string, role?: 'admin'|'user' }
 * Returns: { status, token, user: { id, username, role } }
 */
app.post("/api/auth/register", (req, res) => {
  const { username, password, role = "user" } = req.body;
  if (!username || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "username and password are required" });
  }
  if (!["admin", "user"].includes(role)) {
    return res
      .status(400)
      .json({ status: "error", message: "role must be 'admin' or 'user'" });
  }

  const existing = db
    .prepare("SELECT id FROM users WHERE username = ?")
    .get(username);
  if (existing) {
    return res
      .status(409)
      .json({ status: "error", message: "Username already taken" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
    )
    .run(username, hash, role);

  const newUser = { id: info.lastInsertRowid, username, role };
  const token = signToken(newUser);
  res.status(201).json({ status: "success", token, user: newUser });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's info.
 * Used by the frontend to rehydrate the auth session on page load.
 *
 * Requires: Authorization: Bearer <token>
 * Returns: { status, user: { id, username, role } }
 */
app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, username, role FROM users WHERE id = ?")
    .get(req.user.sub);
  if (!user) {
    return res.status(404).json({ status: "error", message: "User not found" });
  }
  res.json({ status: "success", user });
});

/**
 * WebSocket connection handler.
 * On connect: sends the current bin state immediately so the dashboard
 * doesn't show a blank card while waiting for the first sensor reading.
 * Automatically removes the client from the set on disconnect or error.
 */
wss.on("connection", (ws) => {
  console.log("WS client connected — sending current state");
  clients.add(ws);

  // Send current bin state immediately on connect
  const state = getBinWithCompartments(1);
  if (state) ws.send(JSON.stringify({ type: "state", bin: state }));

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

/**
 * Broadcasts a JSON payload to every connected WebSocket client.
 * Skips clients that are no longer in the OPEN (readyState === 1) state.
 *
 * @param {object} payload - Will be serialised with JSON.stringify
 */
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Liveness probe — returns HTTP 200 with server status and connected client count.
 * Used by monitoring tools and startup checks.
 */
app.get("/api/health", requireAuth, (req, res) => {
  res.json({
    status: "ok",
    connectedClients: clients.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/bins
 * Returns all bins with their latest compartment state.
 * Currently always returns one bin (Dustbin #001).
 * Designed to be extended when more bins are added.
 */
app.get("/api/bins", requireAuth, (req, res) => {
  const bins = db.prepare("SELECT * FROM bins").all();
  const result = bins.map((b) => getBinWithCompartments(b.id));
  res.json({ status: "success", bins: result });
});

/**
 * GET /api/bins/:id/analytics
 * Returns per-day fill-cycle counts for the requested date range.
 *
 * Query params:
 *  range – Number of days to look back (default: 7, max: 90)
 *
 * Response shape:
 *  { status, labels: string[], dry: number[], wet: number[], latest: { date, dry, wet } }
 *
 * Days with zero fill cycles are included in the response so the chart
 * always shows the full requested window rather than sparse points.
 */
app.get("/api/bins/:id/analytics", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin)
    return res.status(404).json({ status: "error", message: "Bin not found" });

  const days = Math.min(parseInt(req.query.range || "7", 10), 90);

  // Build the full date list for the window (so zero days appear)
  const allDays = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    allDays.push(d.toISOString().slice(0, 10));
  }

  // Query stored fill events directly
  const rows = db
    .prepare(
      `
    SELECT date(filled_at) AS day, compartment, COUNT(*) AS cnt
    FROM fill_cycles
    WHERE bin_id = ?
      AND filled_at >= datetime('now', ? || ' days')
    GROUP BY day, compartment
    ORDER BY day ASC
  `,
    )
    .all(binId, `-${days}`);

  // Build lookup maps: { "2026-02-23": count }
  const dryMap = {},
    wetMap = {};
  rows.forEach((r) => {
    if (r.compartment === "dry") dryMap[r.day] = r.cnt;
    if (r.compartment === "wet") wetMap[r.day] = r.cnt;
  });

  // Format labels for display in the chart (e.g. "23 Feb")
  const labels = allDays.map((d) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
  });
  const dry = allDays.map((d) => dryMap[d] ?? 0);
  const wet = allDays.map((d) => wetMap[d] ?? 0);

  // Today's totals for the side panel
  const today = new Date().toISOString().slice(0, 10);
  const latestDate = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  res.json({
    status: "success",
    labels,
    dry,
    wet,
    latest: {
      date: latestDate,
      dry: dryMap[today] ?? 0,
      wet: wetMap[today] ?? 0,
    },
  });
});

/**
 * GET /api/bins/:id
 * Returns full bin details plus the last 50 measurements (for the history modal).
 *
 * Response shape:
 *  { status, bin: BinObject, history: Measurement[] }
 */
app.get("/api/bins/:id", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const bin = getBinWithCompartments(binId);
  if (!bin)
    return res.status(404).json({ status: "error", message: "Bin not found" });

  const history = db
    .prepare(
      `
    SELECT compartment, raw_distance_cm, fill_level_percent, timestamp
    FROM measurements
    WHERE bin_id = ?
    ORDER BY timestamp DESC
    LIMIT 50
  `,
    )
    .all(binId);

  res.json({ status: "success", bin, history });
});

/**
 * POST /api/bins/:id/measurement
 * Records a sensor reading for a single compartment and broadcasts the update.
 *
 * Body (JSON):
 *  compartment      – "dry" | "wet" (default: "dry")
 *  raw_distance_cm  – HC-SR04 reading; fill % is computed server-side
 *  fill_level_percent – Alternative: supply fill % directly; raw distance is back-calculated
 *
 * At least one of raw_distance_cm or fill_level_percent must be provided.
 *
 * Side effects:
 *  1. Inserts into measurements table
 *  2. Calls recordFillCycle to detect/persist fill events
 *  3. Broadcasts { type: "update", bin } to all WebSocket clients
 */
app.post("/api/bins/:id/measurement", requireAuth, (req, res) => {
  const binId = parseInt(req.params.id, 10);
  const bin = db.prepare("SELECT * FROM bins WHERE id = ?").get(binId);
  if (!bin)
    return res.status(404).json({ status: "error", message: "Bin not found" });

  const { raw_distance_cm, fill_level_percent, compartment = "dry" } = req.body;

  if (!["dry", "wet"].includes(compartment)) {
    return res
      .status(400)
      .json({ status: "error", message: "compartment must be 'dry' or 'wet'" });
  }

  let fillLevel, rawDistance;

  if (raw_distance_cm !== undefined) {
    // Primary path: ESP32 sends raw HC-SR04 distance; server computes fill %
    rawDistance = parseFloat(raw_distance_cm);
    fillLevel = computeFillLevel(rawDistance, bin.max_height_cm);
  } else if (fill_level_percent !== undefined) {
    // Alternative path: client already computed fill %; back-calculate raw distance
    fillLevel = Math.min(100, Math.max(0, parseFloat(fill_level_percent)));
    rawDistance = parseFloat(
      ((1 - fillLevel / 100) * bin.max_height_cm).toFixed(2),
    );
  } else {
    return res.status(400).json({
      status: "error",
      message: "Provide raw_distance_cm or fill_level_percent",
    });
  }

  const timestamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO measurements (bin_id, compartment, raw_distance_cm, fill_level_percent, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(binId, compartment, rawDistance, fillLevel, timestamp);

  // Detect & persist fill cycle event
  recordFillCycle(binId, compartment, fillLevel, timestamp);

  const updatedBin = getBinWithCompartments(binId);
  broadcast({ type: "update", bin: updatedBin });

  res.json({
    status: "success",
    message: "Measurement recorded",
    data: {
      bin_id: binId,
      compartment,
      raw_distance_cm: rawDistance,
      fill_level_percent: fillLevel,
      timestamp,
    },
  });
});

/**
 * POST /api/sensor-data
 * Legacy endpoint used by the original ESP32 sketch (ESP32_SAMPLE.ino).
 * Accepts sensor1 (→ dry compartment) and sensor2 (→ wet compartment) raw
 * distance values and records both as measurements for Bin #1.
 *
 * Body (JSON):
 *  sensor1 – HC-SR04 reading for dry waste compartment (cm)
 *  sensor2 – HC-SR04 reading for wet waste compartment (cm)
 *
 * Side effects: same as POST /api/bins/:id/measurement × 2
 */
app.post("/api/sensor-data", (req, res) => {
  const { sensor1, sensor2 } = req.body;
  if (sensor1 === undefined || sensor2 === undefined) {
    return res
      .status(400)
      .json({ status: "error", message: "sensor1 and sensor2 required" });
  }

  const bin = db.prepare("SELECT * FROM bins WHERE id = 1").get();
  const ts = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO measurements (bin_id, compartment, raw_distance_cm, fill_level_percent, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `);

  const dryFill = computeFillLevel(parseFloat(sensor1), bin.max_height_cm);
  const wetFill = computeFillLevel(parseFloat(sensor2), bin.max_height_cm);

  insert.run(1, "dry", parseFloat(sensor1), dryFill, ts);
  insert.run(1, "wet", parseFloat(sensor2), wetFill, ts);

  // Detect & persist fill cycle events for both compartments
  recordFillCycle(1, "dry", dryFill, ts);
  recordFillCycle(1, "wet", wetFill, ts);

  const updatedBin = getBinWithCompartments(1);
  broadcast({ type: "update", bin: updatedBin });

  res.json({ status: "success", message: "Data received", data: updatedBin });
});

// ── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ WebSocket ready at ws://localhost:${PORT}`);
  console.log(`✅ Database: ${DB_PATH}`);
});
