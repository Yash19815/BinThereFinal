/**
 * @file    ESP32_SINGLE_SENSOR.ino
 * @brief   Minimal ESP32 sketch for ONE HC-SR04 ultrasonic sensor.
 *
 * Sends raw_distance_cm to the BinThere dashboard every READ_INTERVAL ms.
 * No servos, no Pi UART, no soil sensor — just the sensor → dashboard pipeline.
 *
 * Server endpoint used:
 *   POST http://<SERVER_IP>:<SERVER_PORT>/api/bins/1/measurement
 *   Body: { "raw_distance_cm": <float>, "compartment": "dry" }
 *
 * ── Wiring (HC-SR04) ──────────────────────────────────────────────────────
 *   HC-SR04 VCC  → ESP32 5 V (or 3.3 V if sensor supports it)
 *   HC-SR04 GND  → ESP32 GND
 *   HC-SR04 TRIG → GPIO 5   (TRIG_PIN)
 *   HC-SR04 ECHO → GPIO 18  (ECHO_PIN)
 *
 * ── How to configure ──────────────────────────────────────────────────────
 *   1. Fill in WIFI_SSID, WIFI_PASSWORD, SERVER_IP, and SERVER_PORT below.
 *   2. Set COMPARTMENT to "dry" or "wet" depending on which bin side this
 *      sensor is mounted on.
 *   3. Flash and open Serial Monitor at 115200 baud.
 */

#include <WiFi.h>
#include <HTTPClient.h>

// ── Configuration (edit these) ────────────────────────────────────────────────

const char* WIFI_SSID     = "Airtel_vamika_2024";
const char* WIFI_PASSWORD = "vamika_2024";

const char* SERVER_IP   = "192.168.1.6";  // Same IP as your dashboard server
const int   SERVER_PORT = 3001;
const char* COMPARTMENT = "dry";           // "dry" or "wet"

// Static device key — must match DEVICE_API_KEY in server/.env
// No login flow needed; the server accepts this header from hardware devices.
const char* DEVICE_API_KEY = "binthere-esp32-device-key-2026";

// ── Pin numbers ───────────────────────────────────────────────────────────────
const int TRIG_PIN = 18;
const int ECHO_PIN = 19;

// ── Timing ────────────────────────────────────────────────────────────────────
const unsigned long READ_INTERVAL = 3000;  // Send a reading every 3 seconds

// ── Internal state ────────────────────────────────────────────────────────────
unsigned long lastReadTime = 0;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fires a single HC-SR04 ping and returns distance in centimetres.
 * Returns 0 on timeout (sensor unplugged / out of range).
 */
float getDistance() {
  // Send a 10 µs trigger pulse
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Wait for the echo; timeout after 30 ms (≈ 510 cm max range)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    Serial.println("[WARN] Ultrasonic timeout — sensor out of range or unplugged.");
    return 0.0;
  }

  float distanceCm = duration * 0.034 / 2.0;
  return distanceCm;
}

/**
 * Sends one distance reading to the dashboard server via HTTP POST.
 * Body format: { "raw_distance_cm": <float>, "compartment": "<dry|wet>" }
 */
void sendToServer(float distanceCm) {
  // Build URL: http://192.168.1.6:3001/api/bins/1/measurement
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/bins/1/measurement";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", DEVICE_API_KEY);

  // Build JSON payload manually (avoids pulling in a JSON library)
  String payload = "{\"raw_distance_cm\":" + String(distanceCm, 2) +
                   ",\"compartment\":\"" + COMPARTMENT + "\"}";

  Serial.print("[POST] → "); Serial.println(payload);

  int code = http.POST(payload);

  if (code > 0) {
    Serial.print("[POST] Response: "); Serial.println(code);
  } else {
    Serial.print("[ERROR] POST failed, code: "); Serial.println(code);
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  Serial.println("\n[BOOT] BinThere Single-Sensor ESP32 starting...");

  // Set up HC-SR04 pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);

  // Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to "); Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[WiFi] Connected! IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("[BOOT] Ready — will post sensor reading every 3 s.");
}

void loop() {
  // Only run every READ_INTERVAL milliseconds (non-blocking)
  if (millis() - lastReadTime < READ_INTERVAL) return;
  lastReadTime = millis();

  // 1. Read the sensor
  float distance = getDistance();
  Serial.print("[SENSOR] Distance: "); Serial.print(distance); Serial.println(" cm");

  // 2. Skip invalid reads to avoid polluting the dashboard
  if (distance <= 0) return;

  // 3. Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost — reconnecting...");
    WiFi.reconnect();
    delay(2000);
    return;
  }

  // 4. Send to dashboard
  sendToServer(distance);
}
