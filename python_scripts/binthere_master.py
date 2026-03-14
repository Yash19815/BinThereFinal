"""
binthere_master.py
The 'Master Brain' of the BinThere project. 
Runs on Raspberry Pi Zero 2W. Watches for motion, commands the ESP32, captures burst 
images, and communicates with the Cloud AI API to make sorting decisions.
Now features secure .env credential loading!
"""

import serial
import time
import cv2
import RPi.GPIO as GPIO
import json
import requests
import logging
import os
from dotenv import load_dotenv

# =========================================================================
# SYSTEM SETUP & CONFIGURATION
# =========================================================================

# Set up logging so every print statement has a timestamp (e.g., 14:02:45 [INFO] ...)
logging.basicConfig(
    level=logging.DEBUG, # Log everything: DEBUG, INFO, WARNING, ERROR
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)

# --- Load Environment Variables ---
# Looks for the .env file in the same folder and loads its contents into memory
load_dotenv()

# Fetch the Cloud API URL from the .env file securely
CLOUD_API_URL = os.getenv("CLOUD_API_URL")

# Fail-safe: If the .env file is missing or misspelled, shut down before causing errors
if not CLOUD_API_URL:
    logging.critical("CRITICAL ERROR: CLOUD_API_URL not found in .env file! Shutting down.")
    exit(1)

# --- Hardware Pins ---
MICROWAVE_PIN = 17      # GPIO pin for Microwave/Motion sensor
LED_PIN = 27            # GPIO pin connected to MOSFET/Resistor for the flash LED

# Initialize Raspberry Pi GPIO pins
GPIO.setmode(GPIO.BCM)
GPIO.setup(MICROWAVE_PIN, GPIO.IN)   # Sensor is an input
GPIO.setup(LED_PIN, GPIO.OUT)        # LED is an output
GPIO.output(LED_PIN, GPIO.LOW)       # Force LED to be OFF on boot

# Initialize UART (Serial) connection to the ESP32
try:
    # '/dev/serial0' targets the default hardware TX/RX pins on the Pi Zero
    esp32 = serial.Serial('/dev/serial0', baudrate=115200, timeout=1)
    logging.info("UART Connection to ESP32 Established.")
except Exception as e:
    logging.error(f"Failed to open UART port: {e}")


# =========================================================================
# HELPER FUNCTIONS
# =========================================================================

def wait_for_esp_message(expected_keyword, timeout_seconds):
    """
    Halts the Pi and listens to the Serial line until the ESP32 says a specific word,
    OR until the timer runs out. This prevents the Pi from freezing if the ESP32 crashes.
    """
    logging.debug(f"Listening for ESP32 keyword: '{expected_keyword}' (Timeout: {timeout_seconds}s)")
    start_time = time.time()
    
    # Keep checking as long as the timeout limit hasn't been reached
    while (time.time() - start_time) < timeout_seconds:
        if esp32.in_waiting > 0: # If data is waiting in the serial buffer
            try:
                # Read it, decode it from bytes to text, and remove blank spaces
                msg = esp32.readline().decode('utf-8').strip()
                logging.debug(f"[UART RX] {msg}")
                
                # Check if the message contains what we are waiting for
                if expected_keyword in msg:
                    return msg
            except UnicodeDecodeError as e:
                logging.error(f"UART Decoding Error (Garbage data?): {e}")
        time.sleep(0.05) # Small delay to prevent maxing out the Pi's CPU
    
    logging.warning(f"Timeout reached waiting for '{expected_keyword}'.")
    return None # Return nothing if it timed out

def capture_burst_images():
    """
    Turns on the LED, quickly snaps 5 photos using OpenCV, and turns everything off.
    Releasing the camera immediately after saves massive amounts of RAM on the Pi.
    """
    logging.info("Triggering LED and initializing Camera...")
    capture_start = time.time()
    
    # 1. Turn on the Flash LED
    GPIO.output(LED_PIN, GPIO.HIGH)
    
    # 2. Boot up the camera hardware (Index 0 is default USB/Pi Camera)
    cap = cv2.VideoCapture(0)
    time.sleep(0.5) # Let the camera sensor adjust to the new LED light level
    
    frames = []
    # 3. Quickly loop 5 times to grab 5 frames
    for i in range(5):
        ret, frame = cap.read() # Read one frame
        if ret:
            frames.append(frame) # Save it to our array
            logging.debug(f"Captured frame {i+1}/5")
        else:
            logging.error(f"Failed to capture frame {i+1}")
        time.sleep(0.1) # Tiny pause between shots
        
    # 4. Turn OFF camera and OFF LED
    cap.release() 
    GPIO.output(LED_PIN, GPIO.LOW)
    
    time_taken = round(time.time() - capture_start, 2)
    logging.info(f"Camera sequence complete. Captured {len(frames)} frames in {time_taken}s.")
    return frames

def send_to_cloud(frames, soil_data):
    """
    Compresses the images, packages them with the soil data, and sends an HTTP POST 
    to the cloud server. Returns "WET" or "DRY" based on the server's response.
    """
    logging.info(f"Packaging payload for Cloud API ({CLOUD_API_URL})...")
    files = []
    
    # Compress the raw OpenCV images into JPEGs so they upload over WiFi faster
    for i, frame in enumerate(frames):
        success, encoded_image = cv2.imencode('.jpg', frame)
        if success:
            # Append as a tuple: ('key_name', ('filename.jpg', binary_data, 'mime_type'))
            files.append(('images', (f'frame_{i}.jpg', encoded_image.tobytes(), 'image/jpeg')))
            
    # Add the soil data to the payload (if the ESP32 successfully sent it earlier)
    payload = {}
    if soil_data is not None:
        payload['soil_moisture'] = soil_data
        
    logging.debug(f"HTTP POST payload prepared. Images: {len(files)}, Soil attached: {soil_data is not None}")
        
    try:
        req_start = time.time()
        # Make the actual HTTP POST request to the cloud
        response = requests.post(CLOUD_API_URL, files=files, data=payload, timeout=15)
        req_time = round(time.time() - req_start, 2)
        
        logging.info(f"Cloud API responded in {req_time}s with Status Code: {response.status_code}")
        
        # If the server responds with a 200 OK success code
        if response.status_code == 200:
            result = response.json().get("classification", "DRY") # Read the JSON answer
            logging.info(f"Model Decision parsed successfully: {result}")
            return result.upper()
        else:
            logging.error(f"Cloud returned bad status code. Response text: {response.text}")
            return "DRY" # Safe default if server logic crashes
            
    except requests.exceptions.Timeout:
        logging.error("Cloud API request TIMED OUT (Took > 15s). Defaulting to DRY.")
        return "DRY"
    except Exception as e:
        logging.error(f"Critical Network Error: {e}. Defaulting to DRY.")
        return "DRY"


# =========================================================================
# MAIN PIPELINE LOOP (The "Brain" of the Bin)
# =========================================================================

logging.info("=== BinThere System Armed & Watching for Motion ===")
try:
    while True:
        
        # PHASE 1: DETECTION
        # Check if the Microwave sensor pin goes HIGH (Motion detected)
        if GPIO.input(MICROWAVE_PIN) == GPIO.HIGH:
            logging.info(">>> MOTION DETECTED BY SENSOR <<<")
            
            # Command ESP32 to open the lid for the user
            esp32.write(b"OPEN_LID\n")
            logging.debug("[UART TX] Sent 'OPEN_LID'")
            
            # PHASE 2: WAIT FOR LID
            # Give the ESP32 10 seconds to respond that it finished the 5s lid cycle
            close_msg = wait_for_esp_message("LID_CLOSED", timeout=10)
            
            # If ESP32 never replies, abort the cycle and wait for the next user
            if not close_msg:
                logging.error("Pipeline Aborted: ESP32 did not close lid in time. Resetting cycle.")
                continue
                
            logging.info("Lid closed confirmation received. Executing parallel tasks.")
            
            # PHASE 3: PARALLEL PROCESSING
            # Task A: Take the burst photos while the ESP32 is reading the soil
            burst_frames = capture_burst_images()
            
            # Task B: Wait up to 4 seconds for the ESP32 to finish reading soil and send it
            soil_msg = wait_for_esp_message("soil", timeout=4)
            soil_value = None
            
            # If we got the JSON string from the ESP32, parse it into a real Python dictionary
            if soil_msg:
                try:
                    data = json.loads(soil_msg) # Convert string '{"soil": 2450}' to object
                    soil_value = data.get("soil")
                    logging.info(f"Successfully parsed Soil Value: {soil_value}")
                except json.JSONDecodeError:
                    logging.error(f"JSON Parsing Error on string: {soil_msg}")
            
            # PHASE 4: CLOUD AI FUSION
            # Send the images (and the soil data, if we got it) to the cloud and get the decision
            decision = send_to_cloud(burst_frames, soil_value)
            
            # Send that final decision (WET or DRY) to the ESP32 so it moves the flap
            logging.info(f"Sending Final Decision to ESP32: {decision}")
            esp32.write(f"{decision}\n".encode('utf-8'))
            
            # PHASE 5: COOLDOWN
            # Wait 8 seconds to ensure the ESP32 has fully dropped the trash and reset the flap
            logging.info("Entering 8-second cooldown to let mechanism finish...")
            time.sleep(8)
            logging.info("=== CYCLE COMPLETE. READY FOR NEXT USER ===")
            
        time.sleep(0.1) # Keep main loop from maxing out CPU while waiting for motion

# This block cleanly shuts down the Pi's pins if you press Ctrl+C in the terminal
except KeyboardInterrupt:
    logging.info("Keyboard Interrupt detected. Shutting down gracefully...")
finally:
    GPIO.cleanup()
    logging.info("GPIO Cleaned up. Goodbye!")