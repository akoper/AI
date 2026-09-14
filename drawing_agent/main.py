import os
import sys
import argparse
import uvicorn
import webbrowser
import threading
import time
from dotenv import load_dotenv

load_dotenv()

def run_web(host: str = "127.0.0.1", port: int = 8000, open_browser: bool = True):
    print("=" * 65)
    print(f"🎨 Starting Gemini ADK Drawing Studio on http://{host}:{port}")
    print("=" * 65)
    
    if open_browser:
        def _open():
            time.sleep(1.2)
            try:
                webbrowser.open(f"http://{host}:{port}")
            except Exception:
                pass
        threading.Thread(target=_open, daemon=True).start()

    uvicorn.run("web.server:app", host=host, port=port, reload=False)

def main():
    parser = argparse.ArgumentParser(description="Google Gemini ADK Drawing Agent")
    parser.add_argument("--cli", action="store_true", help="Launch interactive CLI chat mode")
    parser.add_argument("--web", action="store_true", default=True, help="Launch Web Studio (default)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host address for web server")
    parser.add_argument("--port", type=int, default=8000, help="Port for web server")
    parser.add_argument("--no-browser", action="store_true", help="Do not auto-open browser")
    
    args = parser.parse_args()

    if args.cli:
        import asyncio
        from run_cli import interactive_cli
        asyncio.run(interactive_cli())
    else:
        run_web(host=args.host, port=args.port, open_browser=not args.no_browser)

if __name__ == "__main__":
    main()
