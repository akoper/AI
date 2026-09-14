import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any

from drawing_agent.service import agent_service
from drawing_agent.canvas_manager import canvas_manager

app = FastAPI(title="Google Gemini ADK Drawing Agent Studio")

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"

class ClearRequest(BaseModel):
    background_color: Optional[str] = "#ffffff"

# Ensure drawings directory exists
drawings_dir = Path("drawings")
drawings_dir.mkdir(parents=True, exist_ok=True)

# Mount static drawings directory
app.mount("/drawings", StaticFiles(directory="drawings"), name="drawings")

# Mount web UI static files
web_static_dir = Path(__file__).parent / "static"
web_static_dir.mkdir(parents=True, exist_ok=True)

@app.get("/")
async def read_index():
    index_path = web_static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "Gemini Drawing Agent API is running"}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    result = await agent_service.chat(
        message=request.message.strip(),
        session_id=request.session_id or "default_session"
    )
    return JSONResponse(content=result)

@app.get("/api/current-drawing")
async def get_current_drawing():
    drawing = canvas_manager.get_current_drawing()
    return JSONResponse(content={"drawing": drawing})

@app.get("/api/drawings")
async def get_all_drawings():
    drawings = canvas_manager.get_all_drawings()
    return JSONResponse(content={"drawings": drawings})

@app.post("/api/clear")
async def clear_canvas_endpoint(request: ClearRequest):
    record = canvas_manager.clear_canvas(background_color=request.background_color or "#ffffff")
    return JSONResponse(content={"status": "success", "drawing": record})

@app.get("/api/status")
async def get_status():
    return JSONResponse(content={
        "has_api_key": agent_service.has_api_key(),
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        "drawings_count": len(canvas_manager.history)
    })

# Mount the static directory for CSS/JS
app.mount("/static", StaticFiles(directory=str(web_static_dir)), name="static")
