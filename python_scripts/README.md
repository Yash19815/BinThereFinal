# BinThere - Master Brain (Python Edge AI)

This directory contains the Python scripts forming the "Master Brain" of the BinThere project. Typically deployed on an Edge device (like a Raspberry Pi Zero 2W or a local PC sandbox), this component acts as the intelligence layer, integrating OpenCV for image capture and AWS Bedrock for advanced waste classification.

## Capabilities

- **Computer Vision:** Captures image bursts using USB or Pi cameras when triggered by motion.
- **AI Classification:** Communicates with AWS Bedrock (Claude models) to classify waste types (e.g., Recyclable vs. Organic) with high accuracy.
- **Telemetry Routing:** Acts as a bridge, sending classification results and operational telemetry back to the Node.js Express backend via REST/MQTT.

## Setup & Requirements

> [!IMPORTANT]
> A Python Virtual Environment (`venv`) is strictly required to isolate dependencies and prevent system-wide conflicts.

1. **Create and Activate a Virtual Environment:**
   ```bash
   # Windows
   python -m venv .venv
   .\.venv\Scripts\activate

   # Linux/macOS
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
   *(Installs `fastapi`, `uvicorn`, `opencv-python`, `boto3`, `requests`, etc.)*

3. **AWS Configuration:**
   To leverage AWS Bedrock, your host machine must be configured with valid AWS credentials.
   ```bash
   aws configure
   ```
   Ensure the IAM user has `bedrock:InvokeModel` permissions.

## Scripts Overview

- `binthere_master.py`: The core pipeline. Hooks into local motion detectors, triggers OpenCV, routes the image to AWS Bedrock for classification, and pushes the result to the backend.
- `local_server.py`: A local FastAPI mock server. Used for simulating and testing classification endpoints without physical hardware.
- `send_images.py`: A testing utility to manually upload local image datasets to the model for calibration and testing.
