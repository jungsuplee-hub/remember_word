from pathlib import Path
import sys

import os

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
IMAGES_DIR = BASE_DIR / "images"

if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from database import ensure_schema
from routers import folders, groups, words, profiles, quizzes, auth, admin
from utils.auth import SESSION_MAX_AGE_SECONDS
from utils.bootstrap import ensure_default_accounts

app = FastAPI(title="Remember Word", version="1.0")

app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "remember-word-secret"),
    max_age=SESSION_MAX_AGE_SECONDS,
    same_site="lax",
    https_only=False,
)

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

if IMAGES_DIR.exists():
    app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")


ensure_schema()
ensure_default_accounts()


@app.get("/", response_class=FileResponse)
def root(request: Request):
    """Serve the single page application for the Remember Word project."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        # Fallback to previous JSON response when the front-end is missing
        return JSONResponse({"message": "Remember Word API running on port 8080"})
    if not request.session.get("user_id"):
        return RedirectResponse(url="/static/login.html", status_code=303)
    return FileResponse(index_path)


app.include_router(folders.router, prefix="/folders", tags=["folders"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(words.router, prefix="/words", tags=["words"])
app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(quizzes.router, prefix="/quizzes", tags=["quizzes"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
