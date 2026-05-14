# BinThere OTA Updates (Over-The-Air)

This directory contains resources and documentation for flashing, verifying, and managing Over-The-Air (OTA) firmware updates for the BinThere ESP32 device using the ElegantOTA framework.

## How to Flash OTA Updates

OTA updates allow you to push new C++ firmware to the ESP32 over Wi-Fi without needing a physical USB connection.

1. Ensure the ESP32 is powered on and connected to your local Wi-Fi network.
2. Identify the ESP32's IP address (can be found via your router, the Web Serial Monitor, or the initial USB serial output).
3. Open a web browser and navigate to the update endpoint: `http://<ESP32-IP>/update`
4. Use the web interface to select and upload your newly compiled `.bin` firmware file.

## Security & Authentication

> [!CAUTION]
> **Secure Your Endpoints:** The `/update` endpoint is protected with HTTP Basic Auth to prevent unauthorized users on the network from bricking the device or flashing malicious firmware.

- When prompted by the browser, enter the username and password defined in the `ESP32_Code/config.h` file.
- **Default Developer Credentials:**
  - Username: `binthere_admin`
  - Password: `change_me_before_use`
- **Mandatory Action:** You MUST change these default credentials in `config.h` before deploying the ESP32 to any production or untrusted network environment.

## Included Files

- `ota_confirm.ino`: A minimal fallback sketch used to test basic OTA functionality if the main pipeline fails.
- Reference headers: `config.h` and `webpage.h` serving as examples for standalone OTA implementation.
