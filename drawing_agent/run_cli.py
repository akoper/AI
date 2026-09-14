import os
import sys
import asyncio
import subprocess
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

from drawing_agent.service import agent_service
from drawing_agent.canvas_manager import canvas_manager

def open_file_in_viewer(filepath: str):
    """Opens drawing file in the OS default viewer."""
    try:
        abs_path = os.path.abspath(filepath)
        if sys.platform.startswith('win'):
            os.startfile(abs_path)
        elif sys.platform.startswith('darwin'):
            subprocess.run(['open', abs_path], check=False)
        else:
            subprocess.run(['xdg-open', abs_path], check=False)
    except Exception as e:
        print(f"Could not automatically open file: {e}")

async def interactive_cli():
    print("=" * 65)
    print("🎨 Google Gemini ADK Drawing Agent - Interactive Terminal")
    print("=" * 65)
    
    if agent_service.has_api_key():
        model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        print(f" Connected to Gemini via Google ADK [Model: {model}]")
    else:
        print("ℹ️  Running in Demo/Offline Mode (Set GEMINI_API_KEY for live Gemini agent)")
        
    print("\nCommands:")
    print("  Type what you want the agent to draw (e.g. 'draw a sunset over the mountains')")
    print("  /gallery - View saved drawings")
    print("  /open    - Open the current drawing in viewer")
    print("  /clear   - Reset the canvas")
    print("  /exit    - Quit\n")
    print("-" * 65)

    session_id = "cli_session"
    
    while True:
        try:
            user_input = input("\nYou: ").strip()
            if not user_input:
                continue
                
            if user_input.lower() in ["/exit", "/quit", "exit", "quit"]:
                print("Goodbye! Happy drawing! 🎨")
                break
                
            if user_input.lower() == "/clear":
                rec = canvas_manager.clear_canvas()
                print("Canvas cleared!")
                continue
                
            if user_input.lower() == "/open":
                cur = canvas_manager.get_current_drawing()
                if cur and (cur.get("svg_file") or cur.get("png_file")):
                    target = cur.get("png_file") or cur.get("svg_file")
                    print(f"Opening {target}...")
                    open_file_in_viewer(target)
                else:
                    print("No drawing to open yet.")
                continue

            if user_input.lower() == "/gallery":
                drawings = canvas_manager.get_all_drawings()
                print(f"\n--- Drawing Gallery ({len(drawings)} total) ---")
                for i, d in enumerate(drawings, 1):
                    print(f" {i}. [{d.get('type')}] {d.get('title')} ({d.get('created_at')}) -> {d.get('svg_file') or d.get('png_file')}")
                continue

            print("\n🎨 Gemini Agent is drawing...", end="", flush=True)
            result = await agent_service.chat(message=user_input, session_id=session_id)
            print("\r" + " " * 35 + "\r", end="")

            print(f"\nGemini Agent:\n{result.get('response')}\n")

            drawing = result.get("drawing")
            if drawing:
                svg_path = drawing.get("svg_file")
                png_path = drawing.get("png_file")
                print(f"✨ Artwork saved:")
                if svg_path:
                    print(f"   • SVG: {svg_path}")
                if png_path:
                    print(f"   • PNG: {png_path}")

        except (KeyboardInterrupt, EOFError):
            print("\nSession ended.")
            break
        except Exception as e:
            print(f"\nError: {e}")

if __name__ == "__main__":
    asyncio.run(interactive_cli())
