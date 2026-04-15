/**
 * ============================================================
 *  BinThere — Full IoT Pipeline v5.6
 *  ESP32 | Waste Classification System
 * ============================================================
 *  Changes in v5.6:
 *    [FEAT] Added ElegantOTA for wireless firmware updates
 *           → Visit http://<ESP32-IP>:<WEB_SERIAL_PORT>/update
 *           → NOTE: In ElegantOTA.h, set:
 *                   #define ELEGANTOTA_USE_ASYNC_WEBSERVER 1
 * ============================================================
 */

#include <WiFi.h>

#include <HTTPClient.h>

#include <ESP32Servo.h>

#include <Wire.h>

#include <Adafruit_VL53L0X.h>

#include "esp_task_wdt.h"

#include <ESPAsyncWebServer.h>

#include <Preferences.h>

#include <stdarg.h>

#include <ElegantOTA.h>      // ← v5.6: OTA support


#include "config.h"

#include "webpage.h"

#define WS_QUEUE_SIZE 20
#define WS_MSG_LEN 256
QueueHandle_t wsQueue;

// ── Objects ───────────────────────────────────────────────────
Servo mg995;
Servo sg90;
Adafruit_VL53L0X tof = Adafruit_VL53L0X();
Preferences prefs;

AsyncWebServer webSerial(WEB_SERIAL_PORT);
AsyncWebSocket wsLog(WS_PATH);

// ── State ─────────────────────────────────────────────────────
volatile bool sg90Moving = false;
int mg995Angle = MG995_REST_ANGLE;
int sg90Angle = SG90_REST_ANGLE;
bool tofInitialized = false;
SemaphoreHandle_t wifiMutex;
SemaphoreHandle_t wsMutex;

// =============================================================================
//  NVS — save/load servo angles across reboots
// =============================================================================

void saveAngles() {
  prefs.begin("servos", false);
  prefs.putInt("mg995", mg995Angle);
  prefs.putInt("sg90", sg90Angle);
  prefs.end();
  Serial.printf("[NVS] Saved — MG995: %d° | SG90: %d°\n",
    mg995Angle, sg90Angle);
}

void loadAngles() {
  prefs.begin("servos", true);
  mg995Angle = prefs.getInt("mg995", MG995_REST_ANGLE);
  sg90Angle = prefs.getInt("sg90", SG90_REST_ANGLE);
  prefs.end();
  Serial.printf("[NVS] Loaded — MG995: %d° | SG90: %d°\n",
    mg995Angle, sg90Angle);
}

// =============================================================================
//  LOGGING
// =============================================================================

void blog(const char * msg) {
  Serial.print(msg);

  if (xPortGetCoreID() == 1) {
    if (xSemaphoreTake(wsMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      if (wsLog.count() > 0) wsLog.textAll(msg);
      xSemaphoreGive(wsMutex);
    }
  } else {
    if (wsQueue != NULL) {
      char buf[WS_MSG_LEN];
      strncpy(buf, msg, WS_MSG_LEN - 1);
      buf[WS_MSG_LEN - 1] = '\0';
      xQueueSend(wsQueue, buf, 0);
    }
  }
}
void blogf(const char * fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  blog(buf);
}

// =============================================================================
//  WEBSOCKET EVENT HANDLER
// =============================================================================

void onWsEvent(AsyncWebSocket * server, AsyncWebSocketClient * client,
  AwsEventType type, void * arg, uint8_t * data, size_t len) {
  if (type == WS_EVT_CONNECT) {
    blogf("[WSMON] Client #%u connected from %s\n",
      client -> id(), client -> remoteIP().toString().c_str());
  } else if (type == WS_EVT_DISCONNECT) {
    blogf("[WSMON] Client #%u disconnected\n", client -> id());
  } else if (type == WS_EVT_ERROR) {
    blogf("[WSMON] Client #%u error\n", client -> id());
  }
}

// =============================================================================
//  SERVO HELPERS
// =============================================================================

void attachMG995() {
  mg995.setPeriodHertz(50);
  mg995.attach(MG995_PIN, 500, 2400);
  mg995.write(mg995Angle);
  delay(200);
}

void detachMG995() {
  mg995.detach();
  pinMode(MG995_PIN, OUTPUT);
  digitalWrite(MG995_PIN, LOW);
}

void attachSG90() {
  sg90.setPeriodHertz(50);
  sg90.attach(SG90_PIN, 500, 2400);
  sg90.write(sg90Angle);
  delay(200);
}

void detachSG90() {
  sg90.detach();
  pinMode(SG90_PIN, OUTPUT);
  digitalWrite(SG90_PIN, LOW);
}

// =============================================================================
//  WIFI
// =============================================================================

void reconnectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  blog("[WiFi] Reconnecting...\n");
  WiFi.reconnect();
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; i++) {
    esp_task_wdt_reset();
    delay(500);
    blog(".");
  }
  blog("\n");
}

// =============================================================================
//  DASHBOARD POST
// =============================================================================

void sendToServer(float distCm,
  const char * compartment) {
  if (xSemaphoreTake(wifiMutex, pdMS_TO_TICKS(3000)) != pdTRUE) return;

  reconnectWiFi();

  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT +
    "/api/bins/1/measurement";

  String payload = "{\"raw_distance_cm\":" + String(distCm, 2) +
    ",\"compartment\":\"" + compartment + "\"}";

  bool success = false;

  for (int attempt = 1; attempt <= HTTP_MAX_RETRIES && !success; attempt++) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    http.setTimeout(HTTP_TIMEOUT_MS);

    blogf("[POST] Attempt %d/%d → %s\n",
      attempt, HTTP_MAX_RETRIES, payload.c_str());

    int code = http.POST(payload);

    if (code == 200 || code == 201) {
      blogf("[POST] Success! HTTP %d\n", code);
      success = true;
    } else if (code > 0) {
      blogf("[POST] HTTP %d (unexpected)\n", code);
    } else {
      blogf("[ERROR] Attempt %d failed: %s\n",
        attempt, http.errorToString(code).c_str());
      if (attempt < HTTP_MAX_RETRIES) {
        blogf("[RETRY] Waiting %dms...\n", HTTP_RETRY_DELAY_MS);
        delay(HTTP_RETRY_DELAY_MS);
        reconnectWiFi();
      }
    }
    http.end();
  }

  if (!success) blog("[ERROR] All retries failed. Reading dropped.\n");
  xSemaphoreGive(wifiMutex);
}

// =============================================================================
//  ULTRASONIC SENSORS  (Core 0)
// =============================================================================

float getDistance(int trig, int echo) {
  digitalWrite(trig, LOW);
  delayMicroseconds(2);
  digitalWrite(trig, HIGH);
  delayMicroseconds(10);
  digitalWrite(trig, LOW);
  long dur = pulseIn(echo, HIGH, 30000);
  return (dur == 0) ? 0.0 f : dur * 0.034 f / 2.0 f;
}

void ultrasonicTask(void * param) {
  for (;;) {
    if (!sg90Moving) {
      float dry = getDistance(TRIG_DRY, ECHO_DRY);
      float wet = getDistance(TRIG_WET, ECHO_WET);
      blogf("[ULTRA] Dry: %.1f cm | Wet: %.1f cm\n", dry, wet);
      if (dry > 0) sendToServer(dry, "dry");
      if (wet > 0) sendToServer(wet, "wet");
    } else {
      blog("[ULTRA] SG90 moving — read skipped.\n");
    }
    vTaskDelay(pdMS_TO_TICKS(ULTRASONIC_INTERVAL_MS));
  }
}

// =============================================================================
//  VL53L0X TOF
// =============================================================================

bool wakeTOF() {
  if (!tofInitialized) {
    Wire.begin(VL53_SDA, VL53_SCL);
    if (!tof.begin()) {
      blog("[TOF] Init failed!\n");
      return false;
    }
    tof.configSensor(Adafruit_VL53L0X::VL53L0X_SENSE_HIGH_ACCURACY);
    tof.setMeasurementTimingBudgetMicroSeconds(500000);
    tofInitialized = true;
  }
  blog("[TOF] Sensor ready.\n");
  return true;
}
void sleepTOF() {
  blog("[TOF] Sensor idle.\n");
}

float readTOFForDuration() {
  VL53L0X_RangingMeasurementData_t measure;
  float sum = 0;
  int validCount = 0;
  int readCount = 0;
  unsigned long startMs = millis();

  blogf("[TOF] Sampling for %d ms...\n", TOF_SAMPLE_DURATION_MS);

  while (millis() - startMs < TOF_SAMPLE_DURATION_MS) {
    esp_task_wdt_reset();
    tof.rangingTest( & measure, false);
    readCount++;

    float cm = measure.RangeMilliMeter / 10.0 f;

    if (measure.RangeStatus != 0 || cm >= 819.0 f || cm < 2.0 f) {
      blogf("[TOF] Read %d: %.1f cm status=%d (rejected)\n",
        readCount, cm, measure.RangeStatus);
    } else {
      blogf("[TOF] Read %d: %.1f cm (valid)\n", readCount, cm);
      sum += cm;
      validCount++;
    }

    delay(TOF_READ_DELAY_MS);
  }

  if (validCount == 0) {
    blog("[TOF] No valid readings in sampling window.\n");
    return -1.0 f;
  }

  float avg = sum / validCount;
  blogf("[TOF] Done — %d/%d valid. Average: %.1f cm\n",
    validCount, readCount, avg);
  return avg;
}

// =============================================================================
//  MG995 SERVO  (Lid)
// =============================================================================

void mg995MoveTo(int target) {
  if (target > mg995Angle) {
    for (int a = mg995Angle; a <= target; a++) {
      mg995.write(a);
      mg995Angle = a;
      esp_task_wdt_reset();
      delay(MG995_SPEED_MS);
    }
  } else {
    for (int a = mg995Angle; a >= target; a--) {
      mg995.write(a);
      mg995Angle = a;
      esp_task_wdt_reset();
      delay(MG995_SPEED_MS);
    }
  }
}

void openAndCloseLid() {
  attachMG995();

  blogf("[MG995] Opening lid → %d deg...\n", MG995_OPEN_ANGLE);
  mg995MoveTo(MG995_OPEN_ANGLE);

  blogf("[MG995] Lid open. Holding %d ms — insert waste now.\n", LID_HOLD_MS);
  unsigned long holdStart = millis();
  while (millis() - holdStart < LID_HOLD_MS) {
    esp_task_wdt_reset();
    delay(1000);
    blogf("[MG995] Holding... %lu ms elapsed\n", millis() - holdStart);
  }

  blogf("[MG995] Closing lid → %d deg...\n", MG995_CLOSE_ANGLE);
  mg995MoveTo(MG995_CLOSE_ANGLE);
  delay(300);

  detachMG995();
  blog("[MG995] Lid fully closed. Signal cut.\n");
}

// =============================================================================
//  SG90 SERVO  (Chute)
// =============================================================================

void sg90MoveTo(int target) {
  target = constrain(target, SG90_MIN_ANGLE, SG90_MAX_ANGLE);
  sg90Moving = true;
  if (target > sg90Angle) {
    for (int a = sg90Angle; a <= target; a++) {
      sg90.write(a);
      sg90Angle = a;
      esp_task_wdt_reset();
      delay(SG90_MOVE_SPEED_MS);
    }
  } else {
    for (int a = sg90Angle; a >= target; a--) {
      sg90.write(a);
      sg90Angle = a;
      esp_task_wdt_reset();
      delay(SG90_MOVE_SPEED_MS);
    }
  }
  sg90Moving = false;
}

void routeWaste(bool isDry) {
  int target = isDry ? SG90_DRY_ANGLE : SG90_WET_ANGLE;
  blogf("[SG90] Routing → %s (%d deg)\n", isDry ? "DRY" : "WET", target);
  attachSG90();
  sg90MoveTo(target);
  esp_task_wdt_reset();
  delay(1000);
  blogf("[SG90] Returning → %d deg (centre)\n", SG90_REST_ANGLE);
  sg90MoveTo(SG90_REST_ANGLE);
  delay(300);
  detachSG90();
  blog("[SG90] Back at centre. Signal cut.\n");
}

// =============================================================================
//  SOIL MOISTURE
// =============================================================================

bool classifySoil() {
  blog("[SOIL] Lid closed — powering soil sensor...\n");
  digitalWrite(SOIL_POWER_PIN, HIGH);
  esp_task_wdt_reset();
  delay(500);

  long sum = 0;
  for (int i = 0; i < SOIL_SAMPLES; i++) {
    esp_task_wdt_reset();
    int v = analogRead(SOIL_AO_PIN);
    blogf("[SOIL] Reading %d/%d: ADC=%d\n", i + 1, SOIL_SAMPLES, v);
    sum += v;
    delay(SOIL_SAMPLE_DELAY_MS);
  }

  digitalWrite(SOIL_POWER_PIN, LOW);
  float avg = sum / (float) SOIL_SAMPLES;
  bool dry = avg > SOIL_DRY_THRESHOLD;
  blogf("[SOIL] Average ADC: %.0f | Threshold: %d | Result: %s\n",
    avg, SOIL_DRY_THRESHOLD, dry ? "DRY" : "WET");
  return dry;
}

// =============================================================================
//  POWER MANAGEMENT
// =============================================================================

void standby() {
  digitalWrite(SOIL_POWER_PIN, LOW);
  sleepTOF();
  if (mg995.attached()) detachMG995();
  if (sg90.attached()) detachSG90();
  blog("[POWER] Standby — Microwave + Ultrasonics active.\n\n");
}

// =============================================================================
//  SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n========================================");
  Serial.println("  BinThere ESP32 v5.6 — Booting");
  Serial.println("========================================\n");

  esp_task_wdt_add(NULL);

  // ── GPIO ──────────────────────────────────────────────────────
  pinMode(MICROWAVE_PIN, INPUT);
  pinMode(TRIG_DRY, OUTPUT);
  pinMode(ECHO_DRY, INPUT);
  pinMode(TRIG_WET, OUTPUT);
  pinMode(ECHO_WET, INPUT);
  pinMode(SOIL_POWER_PIN, OUTPUT);
  digitalWrite(SOIL_POWER_PIN, LOW);
  pinMode(MG995_PIN, OUTPUT);
  digitalWrite(MG995_PIN, LOW);
  pinMode(SG90_PIN, OUTPUT);
  digitalWrite(SG90_PIN, LOW);

  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);

  // ── Servo home on boot ────────────────────────────────────────
  loadAngles();

  Serial.printf("[BOOT] MG995 last known: %d° → homing to %d°\n",
    mg995Angle, MG995_REST_ANGLE);
  attachMG995();
  mg995MoveTo(MG995_REST_ANGLE);
  detachMG995();
  Serial.println("[BOOT] MG995 at rest. Signal cut.");

  Serial.printf("[BOOT] SG90 last known: %d° → homing to %d°\n",
    sg90Angle, SG90_REST_ANGLE);
  attachSG90();
  sg90MoveTo(SG90_REST_ANGLE);
  detachSG90();
  Serial.println("[BOOT] SG90 at rest. Signal cut.\n");

  saveAngles();

  // ── WiFi ──────────────────────────────────────────────────────
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    esp_task_wdt_reset();
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("[WiFi] Connected — IP: %s\n",
    WiFi.localIP().toString().c_str());

  wifiMutex = xSemaphoreCreateMutex();
  wsMutex = xSemaphoreCreateMutex();
  wsQueue = xQueueCreate(WS_QUEUE_SIZE, WS_MSG_LEN);

  // ── WebSocket Monitor ─────────────────────────────────────────
  wsLog.onEvent(onWsEvent);
  webSerial.addHandler( & wsLog);
  webSerial.on("/", HTTP_GET, [](AsyncWebServerRequest * req) {
    req -> send_P(200, "text/html", WS_MONITOR_HTML);
  });

  // ── ElegantOTA — attach to existing server ────────────────────
  // v5.6: Enables wireless firmware updates via browser
  // Prerequisite (one-time): In ElegantOTA.h, set:
  //   #define ELEGANTOTA_USE_ASYNC_WEBSERVER 1
  ElegantOTA.begin( & webSerial);

  webSerial.begin();
  Serial.printf("[WSMON] Web Serial Monitor → http://%s:%d/\n",
    WiFi.localIP().toString().c_str(), WEB_SERIAL_PORT);
  Serial.printf("[OTA]   Firmware Update Page → http://%s:%d/update\n",
    WiFi.localIP().toString().c_str(), WEB_SERIAL_PORT);

  xTaskCreatePinnedToCore(
    ultrasonicTask, "UltrasonicTask",
    10240, NULL, 1, NULL, 0
  );

  standby();
  blogf("[BOOT] Ready. Open http://%s:%d/ in your browser.\n\n",
    WiFi.localIP().toString().c_str(), WEB_SERIAL_PORT);
}

// =============================================================================
//  MAIN LOOP  (Core 1)
// =============================================================================

void loop() {
  esp_task_wdt_reset();
  ElegantOTA.loop(); // ← v5.6: handles OTA progress & triggers reboot
  wsLog.cleanupClients();

  char qMsg[WS_MSG_LEN];
  while (xQueueReceive(wsQueue, qMsg, 0) == pdTRUE) {
    if (xSemaphoreTake(wsMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
      if (wsLog.count() > 0) wsLog.textAll(qMsg);
      xSemaphoreGive(wsMutex);
    }
  }

  if (digitalRead(MICROWAVE_PIN) != MOTION_ACTIVE) {
    delay(MICROWAVE_POLL_MS);
    return;
  }

  blog("[MICROWAVE] Motion detected!\n");

  if (!wakeTOF()) {
    blog("[TOF] Sensor unavailable. Back to standby.\n");
    delay(MICROWAVE_POLL_MS);
    return;
  }

  float tofDist = readTOFForDuration();
  sleepTOF();
  esp_task_wdt_reset();

  if (tofDist < 0 || tofDist > TOF_TRIGGER_CM) {
    blog("[TOF] False alarm or out of range — standby.\n\n");
    delay(MICROWAVE_POLL_MS);
    return;
  }
  blogf("[TOF] Object confirmed at %.1f cm — starting cycle.\n\n", tofDist);

  openAndCloseLid();
  esp_task_wdt_reset();

  bool isDry = classifySoil();
  esp_task_wdt_reset();

  routeWaste(isDry);

  saveAngles();

  standby();
  blog("[CYCLE] Complete. Resuming motion monitoring...\n\n");
  esp_task_wdt_reset();
  delay(MICROWAVE_POLL_MS);
}