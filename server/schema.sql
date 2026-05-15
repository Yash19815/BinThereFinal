-- ============================================================
-- BinThere – SQLite Database Schema
-- ============================================================
-- Apply with:
--   sqlite3 bins.db < schema.sql
-- Or let server.js create it automatically on first run.
-- ============================================================

-- ── Bins ─────────────────────────────────────────────────────
-- One row per physical dustbin unit.
CREATE TABLE IF NOT EXISTS bins (
  id              INTEGER PRIMARY KEY,
  name            TEXT    NOT NULL,
  location        TEXT    NOT NULL,
  max_height_cm   REAL    NOT NULL DEFAULT 25   -- empty-bin height (sensor to bottom)
);

-- Default bin (matches server seed; harmless to re-run)
INSERT OR IGNORE INTO bins (id, name, location, max_height_cm)
VALUES (1, 'Dustbin #001', 'Main Campus', 25);

-- ── Measurements ─────────────────────────────────────────────
-- Every sensor reading posted by the ESP32 or test scripts.
CREATE TABLE IF NOT EXISTS measurements (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  bin_id              INTEGER NOT NULL,
  compartment         TEXT    NOT NULL CHECK(compartment IN ('dry', 'wet')),
  raw_distance_cm     REAL    NOT NULL,           -- HC-SR04 raw reading
  fill_level_percent  REAL    NOT NULL,           -- 0–100 %
  timestamp           TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (bin_id) REFERENCES bins(id)
);

-- ── Fill Cycles ───────────────────────────────────────────────
-- One row per detected fill event (bin crossed FULL_THRESHOLD
-- after having been below EMPTY_THRESHOLD).
-- emptied_at is NULL while the bin is still full.
CREATE TABLE IF NOT EXISTS fill_cycles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  bin_id        INTEGER NOT NULL,
  compartment   TEXT    NOT NULL CHECK(compartment IN ('dry', 'wet')),
  filled_at     TEXT    NOT NULL,   -- ISO-8601 timestamp when fill threshold crossed
  emptied_at    TEXT,               -- NULL until bin drops below empty threshold
  FOREIGN KEY (bin_id) REFERENCES bins(id)
);

-- ── Users ─────────────────────────────────────────────────────
-- Registered dashboard users and administrators.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user' CHECK(role IN ('admin','user')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Indexes ───────────────────────────────────────────────────
-- Performance indexes to prevent full table scans on high-frequency queries
CREATE INDEX IF NOT EXISTS idx_measurements_bin_comp_ts
  ON measurements(bin_id, compartment, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_measurements_timestamp
  ON measurements(timestamp);

CREATE INDEX IF NOT EXISTS idx_fill_cycles_bin_comp
  ON fill_cycles(bin_id, compartment, filled_at DESC);

CREATE INDEX IF NOT EXISTS idx_fill_cycles_filled_at
  ON fill_cycles(filled_at);
