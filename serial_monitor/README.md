# Web Serial Monitor

A lightweight, WebSocket-based serial monitor interface designed to read telemetry, debug outputs, and real-time state changes from the ESP32 directly within a web browser, completely eliminating the need for the Arduino IDE.

## Features

- **Browser-Based:** No installation required. Just open the HTML file.
- **Real-Time Streaming:** Connects to the ESP32's WebSocket server to stream logs instantly.
- **Cross-Platform Debugging:** Allows debugging from phones, tablets, or any PC on the same local network.

## Usage Guide

1. **Firmware Preparation:** Ensure the ESP32 is flashed with the BinThere firmware that broadcasts logs over WebSockets (defined via `#define WEB_SERIAL_PORT` and `#define WS_PATH` in `config.h`).
2. **Launch:** Open `monitor.html` in any modern web browser.
3. **Connect:** Enter the ESP32's local IP address (e.g., `ws://192.168.1.100/ws`) and click Connect.
4. **Monitor:** Real-time sensor logs (distances, moisture levels, microwave triggers), debug outputs, and hardware errors will stream directly into the web console.
