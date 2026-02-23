import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "bins.db");

// ── Database Setup ──────────────────────────────────────────────────────────
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS bins (
    id          INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    location    TEXT    NOT NULL,
    max_height_cm REAL  NOT NULL DEFAULT 50
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
`);

// Seed the single bin if not present
const seedBin = db.prepare(
  "INSERT OR IGNORE INTO bins (id, name, location, max_height_cm) VALUES (?, ?, ?, ?)",
);
seedBin.run(1, "Dustbin #001", "Main Campus", 50);

// ── Helpers ─────────────────────────────────────────────────────────────────
function computeFillLevel(rawDistanceCm, maxHeightCm) {
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
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();

app.use(cors());
app.use(express.json());

wss.on("connection", (ws) => {
  console.log("WS client connected — sending current state");
  clients.add(ws);

  // Send current bin state immediately on connect
  const state = getBinWithCompartments(1);
  if (state) ws.send(JSON.stringify({ type: "state", bin: state }));

  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
});

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    connectedClients: clients.size,
    timestamp: new Date().toISOString(),
  });
});

// GET all bins (array, expandable to many bins later)
app.get("/api/bins", (req, res) => {
  const bins = db.prepare("SELECT * FROM bins").all();
  const result = bins.map((b) => getBinWithCompartments(b.id));
  res.json({ status: "success", bins: result });
});

// GET single bin with history
app.get("/api/bins/:id", (req, res) => {
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

// POST measurement from ESP32
// Accepts: { raw_distance_cm: X } or { fill_level_percent: X }
// Compartment determined by query param ?compartment=dry|wet (default: auto from sensor1/sensor2 legacy)
app.post("/api/bins/:id/measurement", (req, res) => {
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
    rawDistance = parseFloat(raw_distance_cm);
    fillLevel = computeFillLevel(rawDistance, bin.max_height_cm);
  } else if (fill_level_percent !== undefined) {
    fillLevel = Math.min(100, Math.max(0, parseFloat(fill_level_percent)));
    rawDistance = parseFloat(
      ((1 - fillLevel / 100) * bin.max_height_cm).toFixed(2),
    );
  } else {
    return res
      .status(400)
      .json({
        status: "error",
        message: "Provide raw_distance_cm or fill_level_percent",
      });
  }

  const timestamp = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO measurements (bin_id, compartment, raw_distance_cm, fill_level_percent, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(binId, compartment, rawDistance, fillLevel, timestamp);

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

// Legacy endpoint – maps sensor1→dry, sensor2→wet for existing ESP32 sketch
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
