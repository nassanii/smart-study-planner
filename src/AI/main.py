from fastapi import FastAPI
from API.routes import router as api_router

# Initialize the Server
app = FastAPI(title="Smart Study Planner - AI Engine")

# Connect our routes
app.include_router(api_router, prefix="/api/v1")

# A simple test route just to see if the server is alive
@app.get("/")
def read_root():
    return {"message": "Welcome to the AI Engine API! The server is running perfectly."}