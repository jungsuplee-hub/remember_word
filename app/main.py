from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"

if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from database import ensure_schema
from routers import folders, groups, words, profiles, quizzes

app = FastAPI(title="Remember Word", version="1.0")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


ensure_schema()


@app.get("/", response_class=FileResponse)
def root():
    """Serve the single page application for the Remember Word project."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        # Fallback to previous JSON response when the front-end is missing
        return JSONResponse({"message": "Remember Word API running on port 8080"})
    return FileResponse(index_path)


app.include_router(folders.router, prefix="/folders", tags=["folders"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(words.router, prefix="/words", tags=["words"])
app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
