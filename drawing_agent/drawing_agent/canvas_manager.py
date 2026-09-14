import os
import io
import re
import json
import time
from typing import Optional, Dict, Any, List
from pathlib import Path
from PIL import Image

class CanvasManager:
    """Manages canvas state, drawing files, and format conversions."""
    
    def __init__(self, output_dir: str = "drawings"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.current_drawing_id: Optional[str] = None
        self.history: List[Dict[str, Any]] = []
        self._load_history()

    def _load_history(self):
        history_file = self.output_dir / "history.json"
        if history_file.exists():
            try:
                with open(history_file, "r", encoding="utf-8") as f:
                    self.history = json.load(f)
                if self.history:
                    self.current_drawing_id = self.history[-1]["id"]
            except Exception:
                self.history = []

    def _save_history(self):
        history_file = self.output_dir / "history.json"
        try:
            with open(history_file, "w", encoding="utf-8") as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to save history: {e}")

    def clean_svg(self, svg_code: str) -> str:
        """Extracts and sanitizes SVG markup from text or markdown blocks."""
        svg_code = svg_code.strip()
        # Remove markdown code blocks if present
        if "```xml" in svg_code:
            svg_code = svg_code.split("```xml", 1)[1].split("```", 1)[0].strip()
        elif "```svg" in svg_code:
            svg_code = svg_code.split("```svg", 1)[1].split("```", 1)[0].strip()
        elif "```" in svg_code:
            svg_code = svg_code.split("```", 1)[1].split("```", 1)[0].strip()

        # Find <svg> ... </svg>
        match = re.search(r"<svg[\s\S]*?</svg>", svg_code, re.IGNORECASE)
        if match:
            svg_code = match.group(0)

        # Ensure xmlns attribute exists
        if "<svg" in svg_code and 'xmlns=' not in svg_code:
            svg_code = svg_code.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"', 1)

        # Ensure viewBox or width/height exist
        if "<svg" in svg_code and 'viewBox' not in svg_code and 'viewbox' not in svg_code:
            if 'width=' in svg_code and 'height=' in svg_code:
                # Add default viewBox based on width/height if numeric
                w_match = re.search(r'width=["\'](\d+)["\']', svg_code)
                h_match = re.search(r'height=["\'](\d+)["\']', svg_code)
                if w_match and h_match:
                    w, h = w_match.group(1), h_match.group(1)
                    svg_code = svg_code.replace('<svg', f'<svg viewBox="0 0 {w} {h}"', 1)
            else:
                svg_code = svg_code.replace('<svg', '<svg viewBox="0 0 800 600" width="800" height="600"', 1)

        return svg_code

    def save_svg(self, svg_content: str, title: str, description: str = "") -> Dict[str, Any]:
        """Saves SVG code, generates PNG raster preview, and tracks in history."""
        cleaned_svg = self.clean_svg(svg_content)
        timestamp = int(time.time())
        safe_title = re.sub(r'[^a-zA-Z0-9_-]', '_', title.lower()).strip('_') or f"drawing_{timestamp}"
        drawing_id = f"{safe_title}_{timestamp}"
        
        svg_filename = f"{drawing_id}.svg"
        png_filename = f"{drawing_id}.png"
        
        svg_path = self.output_dir / svg_filename
        png_path = self.output_dir / png_filename

        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(cleaned_svg)

        # Attempt SVG to PNG conversion
        png_created = False
        try:
            from svglib.svglib import svg2rlg
            from reportlab.graphics import renderPM
            drawing = svg2rlg(str(svg_path))
            if drawing:
                renderPM.drawToFile(drawing, str(png_path), fmt="PNG")
                png_created = True
        except Exception as e:
            # Fallback or error logging
            pass

        record = {
            "id": drawing_id,
            "title": title,
            "description": description,
            "type": "svg",
            "svg_file": str(svg_path.relative_to(self.output_dir.parent) if self.output_dir.parent != self.output_dir else svg_path),
            "png_file": str(png_path.relative_to(self.output_dir.parent) if png_created else ""),
            "svg_content": cleaned_svg,
            "timestamp": timestamp,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))
        }

        self.current_drawing_id = drawing_id
        self.history.append(record)
        self._save_history()

        return record

    def save_pillow_image(self, image: Image.Image, title: str, description: str = "") -> Dict[str, Any]:
        """Saves a PIL Image, tracks in history."""
        timestamp = int(time.time())
        safe_title = re.sub(r'[^a-zA-Z0-9_-]', '_', title.lower()).strip('_') or f"raster_{timestamp}"
        drawing_id = f"{safe_title}_{timestamp}"
        
        png_filename = f"{drawing_id}.png"
        png_path = self.output_dir / png_filename
        image.save(png_path, format="PNG")

        record = {
            "id": drawing_id,
            "title": title,
            "description": description,
            "type": "raster",
            "svg_file": "",
            "png_file": str(png_path.relative_to(self.output_dir.parent) if self.output_dir.parent != self.output_dir else png_path),
            "svg_content": "",
            "timestamp": timestamp,
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))
        }

        self.current_drawing_id = drawing_id
        self.history.append(record)
        self._save_history()

        return record

    def get_current_drawing(self) -> dict[str, Any] | None:
        if not self.history:
            return None
        if self.current_drawing_id:
            for d in reversed(self.history):
                if d["id"] == self.current_drawing_id:
                    return d
        return self.history[-1]

    def get_all_drawings(self) -> list[dict[str, Any]]:
        return self.history

    def clear_canvas(self, background_color: str = "#ffffff") -> Dict[str, Any]:
        empty_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="100%" height="100%" fill="{background_color}"/>
</svg>'''
        return self.save_svg(empty_svg, "blank_canvas", f"A clean blank canvas with {background_color} background.")

canvas_manager = CanvasManager()
