import os
import pytest
import asyncio
from fastapi.testclient import TestClient

from drawing_agent.canvas_manager import CanvasManager, canvas_manager
from drawing_agent.tools import (
    draw_svg,
    modify_current_drawing,
    draw_python_canvas,
    get_current_canvas,
    clear_canvas,
    list_drawing_history,
)
from drawing_agent.agent import root_agent
from drawing_agent.service import agent_service
from web.server import app

def test_canvas_manager_save_svg(tmp_path):
    mgr = CanvasManager(output_dir=str(tmp_path))
    sample_svg = '''<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="80" fill="#38bdf8"/>
    </svg>'''
    record = mgr.save_svg(sample_svg, title="Test Circle", description="A blue circle")
    
    assert record["title"] == "Test Circle"
    assert record["type"] == "svg"
    assert len(mgr.history) == 1
    assert mgr.get_current_drawing()["id"] == record["id"]
    assert os.path.exists(mgr.output_dir / f"{record['id']}.svg")

def test_drawing_tools():
    # Test draw_svg
    res_svg = draw_svg(
        svg_content='<svg viewBox="0 0 800 600"><rect width="800" height="600" fill="#1e1e2f"/></svg>',
        title="Night Sky",
        description="Dark background"
    )
    assert res_svg["status"] == "success"
    assert res_svg["title"] == "Night Sky"

    # Test modify_current_drawing
    res_mod = modify_current_drawing(
        svg_elements_to_add='<circle cx="400" cy="300" r="50" fill="#fbbf24"/>',
        update_title="Night Sky with Moon",
        description="Added a glowing yellow moon"
    )
    assert res_mod["status"] == "success"
    assert "Night Sky with Moon" in res_mod["title"]

    # Test draw_python_canvas
    code = """
img = Image.new('RGB', (400, 300), color='#10b981')
draw = ImageDraw.Draw(img)
draw.rectangle([50, 50, 350, 250], outline='#ffffff', width=3)
"""
    res_py = draw_python_canvas(code=code, title="Python Box", description="A green canvas with border")
    assert res_py["status"] == "success"
    assert res_py["title"] == "Python Box"

    # Test get_current_canvas
    state = get_current_canvas()
    assert state["status"] == "found"

    # Test clear_canvas
    res_clear = clear_canvas(background_color="#000000")
    assert res_clear["status"] == "success"

    # Test list_drawing_history
    history = list_drawing_history()
    assert history["count"] >= 3

def test_root_agent_structure():
    assert root_agent.name == "gemini_drawing_agent"
    assert len(root_agent.tools) >= 5
    assert "You are an expert, imaginative AI Artist" in root_agent.instruction

def test_agent_service_offline():
    result = asyncio.run(agent_service.chat("draw a beautiful sunset over the mountains", session_id="test_sess"))
    assert result["status"] == "success"
    assert "drawing" in result
    assert result["drawing"] is not None

def test_fastapi_endpoints():
    client = TestClient(app)
    
    # Status endpoint
    status_resp = client.get("/api/status")
    assert status_resp.status_code == 200
    data = status_resp.json()
    assert "model" in data
    assert "has_api_key" in data

    # Current drawing endpoint
    cur_resp = client.get("/api/current-drawing")
    assert cur_resp.status_code == 200

    # Drawings list endpoint
    list_resp = client.get("/api/drawings")
    assert list_resp.status_code == 200
    assert "drawings" in list_resp.json()

    # Chat endpoint
    chat_resp = client.post("/api/chat", json={"message": "draw a cute kitten", "session_id": "test_sess"})
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["status"] == "success"
    assert chat_data["drawing"] is not None

    # Clear endpoint
    clear_resp = client.post("/api/clear", json={"background_color": "#121212"})
    assert clear_resp.status_code == 200
    assert clear_resp.json()["status"] == "success"
