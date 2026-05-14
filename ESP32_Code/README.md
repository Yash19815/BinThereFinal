# BinThere - ESP32 Firmware

This directory contains the C++ firmware for the ESP32 microcontroller. The firmware is responsible for interfacing with all hardware peripherals, including ultrasonic sensors, microwave motion detectors, servo motors, soil moisture sensors, and Time-of-Flight (ToF) sensors. It handles local logic and transmits real-time telemetry over MQTT/WebSockets to the backend server.

## Hardware Pin Connections

Based on the `config.h` file, here is the explicit pin mapping and power budget notes for the ESP32:

| Component | ESP32 Pin | Specifications & Notes |
| :--- | :--- | :--- |
| **Microwave Sensor (RCWL-0516)** | `14` | Motion detection (HIGH = active). Polls every 3s. |
| **Servo 1: MG995** | `32` | High-torque servo. **WARNING: External 5V required.** Do not power directly from ESP32. |
| **Servo 2: SG90** | `13` | Standard micro servo. Safe travel limits: 60° to 150°. |
| **Ultrasonic Dry (Trig)** | `5`  | HC-SR04 |
| **Ultrasonic Dry (Echo)** | `18` | HC-SR04 |
| **Ultrasonic Wet (Trig)** | `19` | HC-SR04 |
| **Ultrasonic Wet (Echo)** | `21` | HC-SR04 |
| **Soil Moisture (Power)** | `27` | Digital pin to toggle power (prevents corrosion). |
| **Soil Moisture (Data)**  | `34` | Analog input (AO). Dry threshold: 3000. |
| **VL53L0X TOF (SDA)** | `25` | I2C Data line. |
| **VL53L0X TOF (SCL)** | `22` | I2C Clock line. |

## Power Budget & Actuator Safety

> [!WARNING]
> **Power Isolation is Critical:** The MG995 servo can draw peak stall currents exceeding 1.2A. Powering this servo directly from the ESP32's 5V/VIN pin will cause brownouts and continuous reboots. Always use a dedicated 5V power supply for the servos, ensuring the ground (GND) is shared with the ESP32.

## Software Setup & Deployment

1. **Environment:** Open the Arduino IDE.
2. **Board Manager:** Install the **ESP32 Board** package (`File` -> `Preferences` -> Additional Boards Manager URLs: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`).
3. **Libraries:** Extract the provided `libraries.rar` into your `Documents/Arduino/libraries` folder. Required libraries include `WiFi`, `PubSubClient` (or equivalent), and sensor-specific drivers (e.g., VL53L0X).
4. **Configuration:** 
   - Duplicate `config.h.example` (if present) and rename it to `config.h`. 
   - Enter your `WIFI_SSID`, `WIFI_PASSWORD`, and `SERVER_IP` (the IP address of the machine running the backend server).
   - Set the `DEVICE_API_KEY` to match the backend.
5. **Flash:** Compile and upload the main `.ino` sketch to your ESP32.

## OTA Updates (Over-The-Air)

Once initially flashed via USB, subsequent updates can be done wirelessly:
- Navigate to `http://<ESP32-IP>/update` in your browser.
- Upload the compiled `.bin` file.
- **Authentication:** Use the credentials defined in `config.h` (Default: `binthere_admin` / `change_me_before_use`).
