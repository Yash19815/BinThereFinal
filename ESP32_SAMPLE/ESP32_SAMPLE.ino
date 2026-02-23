#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"  // Include configuration file

// Variables
long duration;

void setup() {
  Serial.begin(115200);
  
  // Initialize sensor 1 pins
  pinMode(TRIG_PIN_1, OUTPUT);
  pinMode(ECHO_PIN_1, INPUT);

  // Initialize sensor 2 pins
  pinMode(TRIG_PIN_2, OUTPUT);
  pinMode(ECHO_PIN_2, INPUT);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("");
  Serial.println("WiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  Serial.print("Server URL: ");
  Serial.println(SERVER_URL);
}

void loop() {
  // Read both sensors
  float distance1 = getDistance(TRIG_PIN_1, ECHO_PIN_1);
  float distance2 = getDistance(TRIG_PIN_2, ECHO_PIN_2);
  
  Serial.print("Sensor 1: ");
  Serial.print(distance1);
  Serial.print(" cm  |  Sensor 2: ");
  Serial.print(distance2);
  Serial.println(" cm");
  
  // Send data to server
  if (WiFi.status() == WL_CONNECTED) {
    sendDataToServer(distance1, distance2);
  } else {
    Serial.println("WiFi disconnected. Reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
  
  delay(READ_INTERVAL);
}

float getDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long dur = pulseIn(echoPin, HIGH);
  float dist = dur * 0.034 / 2;
  
  // Return 0 if reading is invalid
  if (dist > 400 || dist < 2) return 0;
  
  return dist;
}

void sendDataToServer(float dist1, float dist2) {
  HTTPClient http;
  
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  // Send both sensor readings in one payload
  String jsonPayload = "{\"sensor1\":" + String(dist1) + ",\"sensor2\":" + String(dist2) + "}";
  
  int httpResponseCode = http.POST(jsonPayload);
  
  if (httpResponseCode > 0) {
    Serial.print("HTTP Response: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("POST Error: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}
