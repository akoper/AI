# 🎨 Google Gemini ADK Drawing Agent

An intelligent, interactive AI Artist and Drawing Agent built using **Google Agent Development Kit (ADK)** and powered by **Google Gemini**. You can converse naturally with the agent, ask it to draw anything you imagine, iterate on drawings in real-time, and download your artwork in high-resolution SVG or PNG.

---

## ✨ Features

- **Google Gemini ADK Integration**: Built using Google's official `google-adk` framework with `google-genai`, multi-turn session persistence, and custom ADK function tools.
- **Conversational Drawing**: Talk to the agent naturally (e.g., *"Draw a cozy cabin in the snowy forest with aurora borealis"*, *"Now add a glowing crescent moon and stars in the sky"*).
- **Rich Vector & Algorithmic Art**:
  - **SVG Engine**: Layered vector art with gradients, shadows, paths, and vibrant color harmonies.
  - **Progressive Editing**: Add or modify elements on the existing canvas iteratively without starting over.
  - **Python Canvas / Pillow & Matplotlib**: Procedural graphics, fractal art, and bitmap illustrations.
- **Modern Interactive Web Studio**:
  - Split-screen workspace: Chat on the left, live visual canvas on the right.
  - Dynamic SVG / Raster renderer with Zoom (+ / - / Fit) and Pan controls.
  - SVG Code Inspector tab.
  - One-click **SVG** and **PNG** export downloads.
  - **Gallery Drawer**: Browse and switch between previous artworks created across sessions.
- **Interactive Terminal / CLI Mode**: Chat and draw directly inside your terminal with automated rendering and file opening.
- **Google ADK CLI Compatible**: Works directly with native `adk run drawing_agent` and `adk web`.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Your Gemini API Key
Create a `.env` file or set the `GEMINI_API_KEY` environment variable:
```bash
cp .env .env
```

In `.env`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```
*(Get your free API key at [Google AI Studio](https://aistudio.google.com/))*

---

## 🖥️ Running the Agent

### Option 1: Web Studio (Recommended)
Launch the interactive web drawing studio:
```bash
python main.py
```
Open your browser at [http://127.0.0.1:8000](http://127.0.0.1:8000).

### Option 2: Interactive Terminal (CLI)
Chat and draw directly from the command line:
```bash
python run_cli.py
# or
python main.py --cli
```

### Option 3: Using Google ADK CLI
Run directly with the standard Google ADK toolchain:
```bash
adk run drawing_agent
```

---

## 🎨 Example Prompts to Try

- **Scenery**: *"Draw a cozy wooden cabin in a snowy pine forest under a glowing green aurora borealis."*
- **Sci-Fi / Cyberpunk**: *"Draw a glowing neon cyberpunk street at night with flying vehicles and rain reflections."*
- **Characters & Animals**: *"Draw an adorable baby dragon curled around a glowing crystal in a cave."*
- **Iterative Additions**:
  - *"Now add a bright crescent moon and twinkling stars in the sky."*
  - *"Add a sleeping cat on the porch of the cabin."*
- **Abstract & Algorithmic**: *"Draw an algorithmic vibrant spiral fractal pattern using python canvas."*

---

## 📁 Project Structure

```text
├── drawing_agent/          # Google ADK Agent Module
│   ├── __init__.py         # Package exports & root_agent
│   ├── agent.py            # ADK Agent definition & artist system instructions
│   ├── tools.py            # Drawing tools (draw_svg, modify, python canvas, etc.)
│   ├── canvas_manager.py   # State tracking, SVG/PNG conversion, and history
│   └── service.py          # High-level ADK Runner & multi-turn session coordinator
├── web/                    # Web Studio Application
│   ├── server.py           # FastAPI backend endpoints
│   └── static/             # Frontend UI (HTML5, modern CSS, dynamic JS)
│       ├── index.html
│       ├── style.css
│       └── app.js
├── drawings/               # Saved SVG & PNG drawings and history.json
├── tests/                  # Automated pytest test suite
│   └── test_drawing_agent.py
├── run_cli.py              # Interactive terminal conversation runner
├── main.py                 # Unified launcher (web / cli)
├── requirements.txt        # Dependencies
├── .env.example            # Environment configuration template
└── README.md
```

---

## 🧪 Running Tests

Run the test suite with pytest:
```bash
pytest -v
```
