import uvicorn
import shutil
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Local ML Endpoint Mock")

UPLOAD_DIR = Path(__file__).resolve().parent / "received_images"
UPLOAD_DIR.mkdir(exist_ok=True)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Local mock ML server is running"}


@app.post("/analyze")
async def analyze(
    image: UploadFile = File(...),
    moisture_data: float = Form(...)
):
    ALLOWED_TYPES = {
        "image/jpeg", "image/png", "image/bmp",
        "image/webp", "image/tiff", "image/gif"
    }
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {image.content_type}")

    save_path = UPLOAD_DIR / image.filename
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    moisture_status = "wet" if moisture_data < 3000 else "dry"

    mock_result = {
        "condition":        f"mock_condition ({moisture_status})",
        "flap_direction":   "mock_direction",
        "reasoning":        f"Moisture value {moisture_data} indicates {moisture_status} soil.",
        "saved_image_path": str(save_path)
    }

    return JSONResponse(content=mock_result, status_code=200)


if __name__ == "__main__":
    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True)