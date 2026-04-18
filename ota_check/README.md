# BinThere OTA Updates

This directory contains resources for flashing, confirming, and managing Over-The-Air (OTA) updates for the BinThere ESP32 device using ElegantOTA.

## How to use OTA Updates

1. Ensure the ESP32 is powered on and connected to the same local network as your computer.
2. Note the ESP32's IP address (displayed in the Web Serial Monitor or standard Serial Monitor on boot).
3. Open your browser and navigate to `http://<ESP32-IP>/update`.
4. Upload the compiled `.bin` firmware file through the web interface.

### Security & Authentication

The `/update` endpoint is protected with HTTP Basic Auth to prevent unauthorized firmware flashes.
- When prompted by the browser, enter the username and password set in the `ESP32_Code/config.h` file.
- **Default dev credentials are:**
  - Username: `binthere_admin`
  - Password: `change_me_before_use`
- **⚠️ SECURITY WARNING:** You must change these credentials in `config.h` before deploying the ESP32 to a production or untrusted network environment!

## Files

- `ota_confirm.ino`: Simple sketch used to test or fallback to basic OTA.
- `config.h` / `webpage.h`: Headers relevant for the OTA endpoints, serving as a reference if running the test sketch.
