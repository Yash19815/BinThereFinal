#pragma once

// ============================================================
//  BinThere — config.h
//  All user-configurable settings in one place.
//  Edit this file only — never touch the .ino for settings.
// ============================================================

// ── WiFi ─────────────────────────────────────────────────────
#define WIFI_SSID "Airtel_vamika_2024"
#define WIFI_PASSWORD "vamika_2024"

// ── Dashboard Server ─────────────────────────────────────────
#define SERVER_IP "192.168.1.8"
#define SERVER_PORT 3001
#define DEVICE_API_KEY "binthere-esp32-device-key-2026"

// ── Microwave Sensor (RCWL-0516) ─────────────────────────────
#define MICROWAVE_PIN 14
#define MOTION_ACTIVE HIGH

// ── Servo Pins & Angles ───────────────────────────────────────
#define MG995_PIN 32
#define SG90_PIN 13

#define MG995_REST_ANGLE 80
#define SG90_REST_ANGLE 90

#define MG995_OPEN_ANGLE 10
#define MG995_CLOSE_ANGLE 80

#define SG90_DRY_ANGLE 130
#define SG90_WET_ANGLE 40

// ── SG90 safe travel limits ───────────────────────────────────
#define SG90_MIN_ANGLE 60  // never go below this physically
#define SG90_MAX_ANGLE 150 // never go above this physically

// Single speed for MG995 — same for open and close (ms per degree step)
#define MG995_SPEED_MS 60
#define SG90_MOVE_SPEED_MS 40

// ── Ultrasonic Sensors ───────────────────────────────────────
#define TRIG_DRY 5
#define ECHO_DRY 18
#define TRIG_WET 19
#define ECHO_WET 21

// ── Soil Moisture Sensor ─────────────────────────────────────
#define SOIL_POWER_PIN 27
#define SOIL_AO_PIN 34
#define SOIL_SAMPLES 5
#define SOIL_SAMPLE_DELAY_MS 1000
#define SOIL_DRY_THRESHOLD 3000

// ── VL53L0X TOF Sensor ───────────────────────────────────────
#define VL53_SDA 25
#define VL53_SCL 22
#define TOF_TRIGGER_CM                                                         \
  60.0f // ← was 150 (unrealistic), 60 = reliable indoor range
#define TOF_TIMING_BUDGET_US 500000 // was 200000
#define TOF_READ_DELAY_MS 100       // was 50, give sensor time between reads
#define TOF_SAMPLE_DURATION_MS 5000

// ── Timing ───────────────────────────────────────────────────
#define MICROWAVE_POLL_MS 3000
#define ULTRASONIC_INTERVAL_MS 3000
// How long the lid stays open before closing (ms)
#define LID_HOLD_MS 7000

// ── HTTP / Network ───────────────────────────────────────────
#define HTTP_MAX_RETRIES 3
#define HTTP_RETRY_DELAY_MS 1000
#define HTTP_TIMEOUT_MS 5000

// ── Watchdog Timer ───────────────────────────────────────────
#define WDT_TIMEOUT_S 30

// ── Web Serial Monitor ───────────────────────────────────────
#define WEB_SERIAL_PORT 80
#define WS_PATH "/ws"
#define WS_MAX_CLIENTS 4
#define WS_LOG_LINE_CAP 600

// ── OTA Firmware Update ──────────────────────────────────────
#define OTA_USERNAME "binthere_admin"
#define OTA_PASSWORD "change_me_before_use" // User should change this!