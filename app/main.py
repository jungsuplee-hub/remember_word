from fastapi import FastAPI
from routers import folders, groups, words, profiles, quizzes

app = FastAPI(title="Remember Word", version="1.0")

@app.get("/")
def root():
    return {"message": "Remember Word API running on port 8080"}

app.include_router(folders.router, prefix="/folders", tags=["folders"])
app.include_router(groups.router,  prefix="/groups",  tags=["groups"])
app.include_router(words.router,   prefix="/words",   tags=["words"])
app.include_router(profiles.router, prefix="/profiles", tags=["profiles"])
app.include_router(quizzes.router,  prefix="/quizzes",  tags=["quizzes"])
