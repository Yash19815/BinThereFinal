import os
import sys
import json
import logging
import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv

# ─── Load .env ────────────────────────────────────────────────────────────────
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

# ─── Configuration ────────────────────────────────────────────────────────────
ENDPOINT_URL   = os.getenv("CLOUD_API_URL")
API_KEY        = os.getenv("API_KEY", "")
TIMEOUT        = 30
MAX_WORKERS    = 4
SAVE_RESULTS   = True
MOISTURE_DATA  = 2500          # dummy value — below 3000 = wet

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif", ".gif"}
MIME_TYPES = {
    ".jpg":  "image/jpeg", ".jpeg": "image/jpeg",
    ".png":  "image/png",  ".bmp":  "image/bmp",
    ".webp": "image/webp", ".tiff": "image/tiff",
    ".tif":  "image/tiff", ".gif":  "image/gif",
}

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ─── Core Functions ───────────────────────────────────────────────────────────

def validate_config():
    if not ENDPOINT_URL:
        log.error("CLOUD_API_URL is not set. Add it to your .env file.")
        sys.exit(1)
    log.info(f"Endpoint loaded from .env → {ENDPOINT_URL}")


def get_images_in_script_dir() -> list[Path]:
    script_dir = Path(__file__).resolve().parent
    images = [
        f for f in script_dir.iterdir()
        if f.is_file() and f.suffix.lower() in IMAGE_EXTENSIONS
    ]
    return sorted(images)


def send_image(image_path: Path) -> dict:
    mime = MIME_TYPES.get(image_path.suffix.lower(), "application/octet-stream")
    headers = {}
    if API_KEY:
        headers["x-api-key"] = API_KEY

    try:
        with open(image_path, "rb") as img_file:
            files = {"image": (image_path.name, img_file, mime)}  # ← field name is "image"
            data  = {"moisture_data": MOISTURE_DATA}               # ← required number field
            response = requests.post(
                ENDPOINT_URL,
                files=files,
                data=data,
                headers=headers,
                timeout=TIMEOUT,
            )
        response.raise_for_status()

        try:
            result = response.json()
        except ValueError:
            result = {"raw_response": response.text}

        log.info(f"✅  {image_path.name} → {response.status_code} | {result}")
        return {"image": image_path.name, "status": "success", "response": result}

    except requests.exceptions.ConnectionError:
        log.error(f"❌  {image_path.name} → Cannot reach {ENDPOINT_URL}. Is the EC2 instance running?")
        return {"image": image_path.name, "status": "error", "error": "ConnectionError"}

    except requests.exceptions.Timeout:
        log.error(f"⏱️  {image_path.name} → Request timed out after {TIMEOUT}s")
        return {"image": image_path.name, "status": "error", "error": "Timeout"}

    except requests.exceptions.HTTPError as e:
        log.error(f"⚠️  {image_path.name} → HTTP {response.status_code}: {e}")
        return {"image": image_path.name, "status": "error", "error": str(e), "status_code": response.status_code}

    except Exception as e:
        log.error(f"💥  {image_path.name} → Unexpected error: {e}")
        return {"image": image_path.name, "status": "error", "error": str(e)}


def run():
    validate_config()

    images = get_images_in_script_dir()

    if not images:
        log.warning("No images found in the script's directory. Exiting.")
        sys.exit(0)

    log.info(f"Found {len(images)} image(s) → sending to {ENDPOINT_URL}")

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(send_image, img): img for img in images}
        for future in as_completed(futures):
            results.append(future.result())

    success = sum(1 for r in results if r["status"] == "success")
    failed  = len(results) - success
    log.info(f"\n── Done ── {success} succeeded | {failed} failed out of {len(results)} total")

    if SAVE_RESULTS:
        output_path = Path(__file__).resolve().parent / "results.json"
        with open(output_path, "w") as f:
            json.dump(results, f, indent=2)
        log.info(f"Results saved to {output_path}")


if __name__ == "__main__":
    run()