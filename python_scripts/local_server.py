import uvicorn
import shutil
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

app = FastAPI(title="Local ML Endpoint Mock")

UPLOAD_DIR = Path(__file__).resolve().parent / "received_images"
UPLOAD_DIR.mkdir(exist_ok=True)


@app.get("/")
def health_check():
    return {"status": "ok", "message": "Local mock ML server is running"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Validate file is an image
    ALLOWED_TYPES = {
        "image/jpeg", "image/png", "image/bmp",
        "image/webp", "image/tiff", "image/gif"
    }
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}"
        )

    # Save received image to received_images/
    save_path = UPLOAD_DIR / file.filename
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    file_size_kb = save_path.stat().st_size / 1024

    # ── Mock ML inference response ──────────────────────────────────────────
    # Replace this block with actual model inference logic if needed
    mock_result = {
        "filename":    file.filename,
        "content_type": file.content_type,
        "size_kb":     round(file_size_kb, 2),
        "prediction":  "mock_class",       # replace with model output
        "confidence":  0.97,               # replace with model output
        "status":      "success"
    }

    return JSONResponse(content=mock_result, status_code=200)


if __name__ == "__main__":
    uvicorn.run("local_server:app", host="0.0.0.0", port=8000, reload=True)