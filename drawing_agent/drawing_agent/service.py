import os
import asyncio
import json
from typing import AsyncGenerator, Dict, Any, List, Optional
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .agent import root_agent
from .canvas_manager import canvas_manager
from .tools import draw_svg

class DrawingAgentService:
    """Coordinates Google ADK Agent runs, manages user sessions, and syncs canvas outputs."""
    
    def __init__(self):
        self.session_service = InMemorySessionService()
        self.runner = Runner(
            app_name="drawing_agent",
            agent=root_agent,
            session_service=self.session_service,
            auto_create_session=True
        )
        self.active_sessions: set[str] = set()

    def has_api_key(self) -> bool:
        return bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"))

    async def ensure_session(self, user_id: str, session_id: str):
        if session_id not in self.active_sessions:
            try:
                await self.session_service.create_session(
                    app_name="drawing_agent",
                    user_id=user_id,
                    session_id=session_id
                )
            except Exception:
                pass
            self.active_sessions.add(session_id)

    async def chat(self, message: str, session_id: str = "default_session", user_id: str = "user") -> Dict[str, Any]:
        """
        Sends a user prompt to the Google ADK Agent and waits for completion.
        Returns the assistant's response text and any newly created drawing metadata.
        """
        await self.ensure_session(user_id=user_id, session_id=session_id)
        
        # Check if API key is present
        if not self.has_api_key():
            # Return guidance and an offline demo drawing if appropriate
            return self._handle_offline_chat(message)

        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=message)]
        )

        response_text = []
        tool_calls = []
        drawing_created = None

        try:
            initial_count = len(canvas_manager.history)
            async for event in self.runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=content
            ):
                # Process ADK events
                if hasattr(event, "content") and event.content:
                    if hasattr(event.content, "parts"):
                        for part in event.content.parts:
                            if hasattr(part, "text") and part.text:
                                response_text.append(part.text)
                            if hasattr(part, "function_call") and part.function_call:
                                tool_calls.append({
                                    "name": part.function_call.name,
                                    "args": part.function_call.args
                                })
                elif hasattr(event, "text") and event.text:
                    response_text.append(event.text)

            # Check if a new drawing was generated during this turn
            if len(canvas_manager.history) > initial_count:
                drawing_created = canvas_manager.get_current_drawing()

            full_text = "".join(response_text).strip()
            if not full_text and drawing_created:
                full_text = f"I've created '{drawing_created.get('title', 'Drawing')}' for you! You can see it on the canvas."

            return {
                "status": "success",
                "response": full_text or "Here is what I drew for you!",
                "drawing": drawing_created,
                "tool_calls": tool_calls
            }

        except Exception as e:
            err_msg = str(e)
            if "API_KEY" in err_msg or "403" in err_msg or "401" in err_msg:
                return self._handle_offline_chat(message, error_note=err_msg)
            return {
                "status": "error",
                "response": f"Encountered an issue running the agent: {err_msg}",
                "drawing": canvas_manager.get_current_drawing()
            }

    def _handle_offline_chat(self, message: str, error_note: str = "") -> Dict[str, Any]:
        """Provides helpful setup guidance and fallback procedural drawing generation."""
        msg_lower = message.lower()
        title = "Art Concept"
        
        # Smart offline drawing generator based on user prompt keywords
        if "sunset" in msg_lower or "mountain" in msg_lower:
            title = "Sunset Over Mountains"
            svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff7e5f"/>
      <stop offset="50%" stop-color="#feb47b"/>
      <stop offset="100%" stop-color="#ffeccc"/>
    </linearGradient>
    <linearGradient id="sun" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffc00"/>
      <stop offset="100%" stop-color="#ff512f"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#sky)"/>
  <circle cx="400" cy="300" r="100" fill="url(#sun)" opacity="0.9"/>
  <polygon points="50,600 300,320 550,600" fill="#4a154b" opacity="0.8"/>
  <polygon points="250,600 500,280 750,600" fill="#2e0854"/>
  <polygon points="450,600 650,380 850,600" fill="#1b003a"/>
</svg>'''
        elif "cat" in msg_lower or "kitten" in msg_lower:
            title = "Cute Whimsical Cat"
            svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="75%">
      <stop offset="0%" stop-color="#fdfbfb"/>
      <stop offset="100%" stop-color="#ebedee"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <!-- Cat Body -->
  <ellipse cx="400" cy="420" rx="140" ry="120" fill="#f97316"/>
  <!-- Head -->
  <circle cx="400" cy="270" r="95" fill="#f97316"/>
  <!-- Ears -->
  <polygon points="320,230 350,140 380,200" fill="#ea580c"/>
  <polygon points="335,215 350,160 370,195" fill="#fbcfe8"/>
  <polygon points="480,230 450,140 420,200" fill="#ea580c"/>
  <polygon points="465,215 450,160 430,195" fill="#fbcfe8"/>
  <!-- Eyes -->
  <ellipse cx="365" cy="265" rx="14" ry="20" fill="#0284c7"/>
  <circle cx="362" cy="260" r="5" fill="#ffffff"/>
  <ellipse cx="435" cy="265" rx="14" ry="20" fill="#0284c7"/>
  <circle cx="432" cy="260" r="5" fill="#ffffff"/>
  <!-- Nose & Mouth -->
  <polygon points="395,290 405,290 400,298" fill="#ec4899"/>
  <path d="M 390 305 Q 400 315 400 300 Q 400 315 410 305" stroke="#333" stroke-width="3" fill="none"/>
  <!-- Whiskers -->
  <line x1="330" y1="290" x2="270" y2="280" stroke="#475569" stroke-width="2"/>
  <line x1="330" y1="300" x2="265" y2="305" stroke="#475569" stroke-width="2"/>
  <line x1="470" y1="290" x2="530" y2="280" stroke="#475569" stroke-width="2"/>
  <line x1="470" y1="300" x2="535" y2="305" stroke="#475569" stroke-width="2"/>
</svg>'''
        else:
            title = "Vibrant Abstract Artwork"
            svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
    <radialGradient id="g2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.2"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#0f172a"/>
  <circle cx="250" cy="300" r="180" fill="url(#g1)" opacity="0.8"/>
  <circle cx="550" cy="300" r="180" fill="url(#g2)" opacity="0.85"/>
  <rect x="250" y="200" width="300" height="200" rx="30" fill="#ffffff" fill-opacity="0.08" stroke="#38bdf8" stroke-width="2"/>
  <text x="400" y="290" fill="#ffffff" font-family="system-ui, sans-serif" font-size="26" font-weight="bold" text-anchor="middle">Drawing: {title}</text>
  <text x="400" y="330" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="16" text-anchor="middle">Ready for your prompt</text>
</svg>'''

        draw_result = draw_svg(svg, title=title, description=f"Visual interpretation for '{message}'")
        drawing = canvas_manager.get_current_drawing()

        notice = ""
        if not self.has_api_key():
            notice = "\n\n💡 *Note: Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) environment variable for full autonomous Gemini AI drawing generation. I've rendered a procedural drawing preview in the meantime.*"

        return {
            "status": "success",
            "response": f"I've created an illustration of **{title}** based on your prompt: *\"{message}\"*!{notice}",
            "drawing": drawing,
            "offline_mode": True
        }

agent_service = DrawingAgentService()
