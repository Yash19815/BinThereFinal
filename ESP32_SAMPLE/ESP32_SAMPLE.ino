/**
 * @file    BinThere_ESP32_Worker.ino
 * @brief   ESP32 Hardware Slave. Controls servos, reads soil/ultrasonic sensors, 
 * and updates the web dashboard. Takes all sorting commands from the Pi.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ESP32Servo.h>
#include "config.h" // Loads all your pin numbers and WiFi credentials

// --- Global Variables & Objects ---
HardwareSerial PiSerial(2);  // Defines a hardware serial port (UART2) to talk to the Pi
Servo flapServo;             // Object to control the internal sorting flap
Servo lidServo;              // Object to control the top lid
unsigned long lastReadTime = 0; // Tracks time for the non-blocking 3-second delay
bool isSortingCycle = false; // Flag to pause dashboard updates when the bin is actively sorting

// =========================================================================
// HELPER FUNCTIONS (The "Tools" the ESP32 uses)
// =========================================================================

/**
 * @brief Wakes up the Flap Servo, moves it, and puts it back to sleep.
 * @param angle The degree to move the servo to (50 = Wet, 150 = Dry, 90 = Neutral)
 */
void moveFlap(int angle) {
  Serial.print("[DEBUG] Moving Flap to: "); Serial.println(angle);
  flapServo.attach(FLAP_SERVO_PIN, 500, 2400); // 1. Re-connect the PWM signal
  flapServo.write(angle);                      // 2. Command the movement
  delay(800);                                  // 3. Wait 800ms for physical gears to finish moving
  flapServo.detach();                          // 4. Cut the signal (stops the gears from jittering!)
}

/**
 * @brief Wakes up the Lid Servo, moves it, and puts it back to sleep.
 * @param angle The degree to move the lid (90 = Open, 0 = Closed)
 */
void moveLid(int angle) {
  Serial.print("[DEBUG] Moving Lid to: "); Serial.println(angle);
  lidServo.attach(LID_SERVO_PIN, 500, 2400);
  lidServo.write(angle);
  delay(800);
  lidServo.detach();
}

/**
 * @brief Pings an ultrasonic sensor and calculates the distance in cm.
 */
float getDistance(int trigPin, int echoPin) {
  // Fire a 10-microsecond sound pulse
  digitalWrite(trigPin, LOW); delayMicroseconds(2);
  digitalWrite(trigPin, HIGH); delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  // Measure how long it takes for the echo to bounce back (Timeout at 30ms)
  long dur = pulseIn(echoPin, HIGH, 30000); 
  float dist = dur * 0.034 / 2; // Convert time to centimeters
  
  // Fail-safe: If sensor is unplugged or out of range, return 0 instead of crashing
  if (dist == 0 || dist > 400) {
    Serial.print("[DEBUG-WARNING] Ultrasonic Timeout on ECHO PIN ");
    Serial.println(echoPin);
    return 0;
  }
  return dist;
}

/**
 * @brief Packages the ultrasonic distances into JSON and sends to the Web Dashboard.
 */
void sendDataToServer(float dist1, float dist2) {
  HTTPClient http;
  http.begin(SERVER_URL); // Connect to the Node.js server
  http.addHeader("Content-Type", "application/json"); // Tell server to expect JSON
  
  // Manually build the JSON string: {"sensor1": X, "sensor2": Y}
  String jsonPayload = "{\"sensor1\":" + String(dist1) + ",\"sensor2\":" + String(dist2) + "}";
  Serial.print("[DEBUG] POSTing to Dashboard: "); Serial.println(jsonPayload);
  
  int httpResponseCode = http.POST(jsonPayload); // Actually send the data
  
  if(httpResponseCode > 0) {
    Serial.print("[DEBUG] Dashboard POST Success. Code: "); Serial.println(httpResponseCode);
  } else {
    Serial.print("[DEBUG-ERROR] Dashboard POST Failed. Code: "); Serial.println(httpResponseCode);
  }
  http.end(); // Close connection to free up memory
}

// =========================================================================
// SETUP (Runs exactly once when the ESP32 is powered on)
// =========================================================================
void setup() {
  Serial.begin(115200); // Start serial for the PC monitor (Debugging)
  PiSerial.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN); // Start UART serial to talk to the Pi
  
  Serial.println("\n[DEBUG] --- ESP32 BOOTING UP ---");

  // Define input/output roles for all pins
  pinMode(TRIG_PIN_1, OUTPUT); pinMode(ECHO_PIN_1, INPUT);
  pinMode(TRIG_PIN_2, OUTPUT); pinMode(ECHO_PIN_2, INPUT);
  pinMode(SOIL_PWR_PIN, OUTPUT);
  
  digitalWrite(SOIL_PWR_PIN, LOW); // Keep soil sensor OFF initially to save power

  // Configure servos to standard 50Hz frequency and move to resting positions
  flapServo.setPeriodHertz(50);
  lidServo.setPeriodHertz(50);
  moveFlap(90);  // Flap straight down (Neutral)
  moveLid(0);    // Lid shut
  
  // Try to connect to the Wi-Fi router
  Serial.print("[DEBUG] Connecting to WiFi: "); Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[DEBUG] WiFi Connected! IP: " + WiFi.localIP().toString());
  Serial.println("[DEBUG] BinThere ESP32 Ready and listening to Pi...");
}

// =========================================================================
// MAIN LOOP (Runs continuously forever)
// =========================================================================
void loop() {
  
  // ---------------------------------------------------------
  // 1. BACKGROUND TASK: Dashboard Updates (Runs every 3 seconds)
  // ---------------------------------------------------------
  // The 'isSortingCycle' prevents the ESP32 from getting distracted by the 
  // dashboard while the user is actively throwing away trash.
  if (!isSortingCycle && (millis() - lastReadTime >= READ_INTERVAL)) {
    float dist1 = getDistance(TRIG_PIN_1, ECHO_PIN_1);
    float dist2 = getDistance(TRIG_PIN_2, ECHO_PIN_2);
    
    if (WiFi.status() == WL_CONNECTED) {
      sendDataToServer(dist1, dist2);
    } else {
      Serial.println("[DEBUG-ERROR] WiFi Lost! Attempting reconnect...");
      WiFi.reconnect();
    }
    lastReadTime = millis(); // Reset the 3-second timer
  }

  // ---------------------------------------------------------
  // 2. LISTEN FOR PI COMMANDS (The core pipeline)
  // ---------------------------------------------------------
  // Check if a message arrived from the Pi via the TX/RX wires
  if (PiSerial.available()) {
    String command = PiSerial.readStringUntil('\n'); // Read until the end of the line
    command.trim(); // Clean up any hidden whitespace/return characters
    
    Serial.print("\n[DEBUG-UART] Raw command received from Pi: ["); 
    Serial.print(command); Serial.println("]");
    
    // --- PHASE 2: THE DEPOSIT (User triggered the Pi sensor) ---
    if (command == "OPEN_LID") {
      isSortingCycle = true; // Tell ESP32 to stop updating the web dashboard
      Serial.println("[DEBUG] Executing OPEN_LID sequence...");
      
      moveLid(90);   // Open the physical lid
      Serial.println("[DEBUG] Waiting 5s for user deposit...");
      delay(5000);   // Hold lid open for exactly 5 seconds
      moveLid(0);    // Shut the lid
      
      // Tell Pi the lid is closed so it can safely take photos
      PiSerial.println("LID_CLOSED");
      Serial.println("[DEBUG-UART] Sent to Pi: LID_CLOSED");

      // --- PHASE 3: SOIL PROCESSING ---
      Serial.println("[DEBUG] Starting 3-second Soil Analysis...");
      digitalWrite(SOIL_PWR_PIN, HIGH); // Turn sensor ON
      delay(100); // Give electricity 100ms to stabilize

      long totalMoisture = 0;
      // Loop 3 times to get an average (prevents false readings from a single bad read)
      for (int i = 0; i < 3; i++) {
        delay(1000); // Wait 1 second between each read
        int reading = analogRead(SOIL_DATA_PIN);
        Serial.print("[DEBUG] Soil Read "); Serial.print(i+1); Serial.print("/3: "); Serial.println(reading);
        totalMoisture += reading;
      }
      digitalWrite(SOIL_PWR_PIN, LOW); // Turn sensor OFF to stop metallic corrosion
      
      int avgMoisture = totalMoisture / 3; // Calculate the average
      Serial.print("[DEBUG] Soil Average Calculated: "); Serial.println(avgMoisture);

      // Package the soil average into JSON and send it via UART to the Pi
      String jsonResponse = "{\"soil\": " + String(avgMoisture) + "}";
      PiSerial.println(jsonResponse);
      Serial.println("[DEBUG-UART] Sent to Pi: " + jsonResponse);
    }
    
    // --- PHASE 4: THE SORTING EXECUTION (Cloud AI made a decision) ---
    else if (command == "WET") {
      Serial.println("[DEBUG] Executing WET Waste Sorting...");
      moveFlap(50); // Tilt flap to wet side
      delay(5000);  // Give gravity 5 seconds to pull the trash down
      moveFlap(90); // Return to neutral flat position
      Serial.println("[DEBUG] Cycle Complete. Resuming Dashboard Updates.");
      isSortingCycle = false; // Allow web dashboard updates to resume
    }
    
    else if (command == "DRY") {
      Serial.println("[DEBUG] Executing DRY Waste Sorting...");
      moveFlap(150); // Tilt flap to dry side
      delay(5000);   // Give gravity 5 seconds
      moveFlap(90);  // Return to neutral
      Serial.println("[DEBUG] Cycle Complete. Resuming Dashboard Updates.");
      isSortingCycle = false; // Allow web dashboard updates to resume
    }
    
    // Catch-all for garbage data on the serial line
    else {
      Serial.println("[DEBUG-ERROR] Unknown command received. Ignored.");
    }
  }
}