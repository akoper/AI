import io
import re
from typing import Dict, Any
from PIL import Image, ImageDraw, ImageFont
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from .canvas_manager import canvas_manager

def draw_svg(svg_content: str, title: str = "Artwork", description: str = "") -> dict:
    """
    Creates and renders a new vector drawing / artwork using SVG markup.
    
    Args:
        svg_content: Complete SVG XML string (with <svg>...</svg> root element). Use rich SVG features: paths, shapes, gradients, shadows, text, strokes, styling.
        title: Short descriptive title for the drawing (e.g., 'Sunset Over Mountain', 'Neon Cyberpunk City').
        description: A brief artistic description of the visual composition.
        
    Returns:
        A dictionary containing drawing status, drawing ID, file paths, and summary.
    """
    try:
        record = canvas_manager.save_svg(svg_content=svg_content, title=title, description=description)
        return {
            "status": "success",
            "message": f"Successfully created drawing '{title}'",
            "drawing_id": record["id"],
            "title": record["title"],
            "svg_file": record["svg_file"],
            "png_file": record["png_file"],
            "description": description
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to draw SVG: {str(e)}"
        }

def modify_current_drawing(svg_elements_to_add: str, update_title: str = "", description: str = "") -> dict:
    """
    Modifies or adds elements to the current active drawing canvas.
    
    Args:
        svg_elements_to_add: SVG elements (e.g., <circle .../>, <path .../>, <g>...</g>) to insert into the existing SVG artwork before the closing </svg> tag.
        update_title: Updated title for the modified artwork.
        description: Description of the modifications made.
        
    Returns:
        A dictionary containing update status, updated drawing ID, and file paths.
    """
    current = canvas_manager.get_current_drawing()
    if not current or not current.get("svg_content"):
        # If no current drawing, create a new one wrapping the elements
        new_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <rect width="100%" height="100%" fill="#1a1a2e"/>
  {svg_elements_to_add}
</svg>'''
        return draw_svg(new_svg, title=update_title or "New Drawing", description=description)
    
    current_svg = current["svg_content"]
    # Insert before </svg>
    if "</svg>" in current_svg:
        updated_svg = current_svg.replace("</svg>", f"\n  <!-- Added Elements -->\n  {svg_elements_to_add}\n</svg>")
    else:
        updated_svg = current_svg + f"\n{svg_elements_to_add}"
        
    new_title = update_title or f"{current.get('title', 'drawing')}_updated"
    return draw_svg(updated_svg, title=new_title, description=description or "Updated current drawing")

def draw_python_canvas(code: str, title: str = "Canvas Art", description: str = "") -> dict:
    """
    Generates an image using Python code (Pillow or Matplotlib).
    The code should create an image named `img` (a PIL.Image.Image instance) or a matplotlib figure `fig`.
    
    Example code:
    ```python
    img = Image.new('RGBA', (800, 600), color='#0f172a')
    draw = ImageDraw.Draw(img)
    draw.ellipse([200, 100, 600, 500], fill='#38bdf8', outline='#e0f2fe', width=4)
    ```
    
    Args:
        code: Python script snippet that produces `img` (PIL Image) or `fig` (matplotlib Figure).
        title: Title of the artwork.
        description: Description of what was drawn.
        
    Returns:
        A dictionary containing status, image file paths, and summary.
    """
    try:
        local_scope = {
            "Image": Image,
            "ImageDraw": ImageDraw,
            "ImageFont": ImageFont,
            "plt": plt,
            "io": io
        }
        
        exec(code, local_scope)
        
        img = local_scope.get("img")
        fig = local_scope.get("fig")
        
        if fig is not None and img is None:
            buf = io.BytesIO()
            fig.savefig(buf, format="png", bbox_inches="tight", dpi=150)
            plt.close(fig)
            buf.seek(0)
            img = Image.open(buf)
            
        if img is None:
            return {
                "status": "error",
                "message": "The code did not produce an 'img' (PIL Image) or 'fig' (matplotlib Figure) variable."
            }
            
        record = canvas_manager.save_pillow_image(img, title=title, description=description)
        return {
            "status": "success",
            "message": f"Successfully rendered raster drawing '{title}'",
            "drawing_id": record["id"],
            "title": record["title"],
            "png_file": record["png_file"],
            "description": description
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Failed to execute drawing code: {str(e)}"
        }

def get_current_canvas() -> dict:
    """
    Returns the current active drawing and its SVG code/metadata.
    Use this to inspect what is currently drawn before modifying or adding elements.
    """
    current = canvas_manager.get_current_drawing()
    if not current:
        return {"status": "empty", "message": "No drawings have been created yet."}
    return {
        "status": "found",
        "drawing_id": current["id"],
        "title": current["title"],
        "type": current["type"],
        "description": current["description"],
        "svg_content": current.get("svg_content", ""),
        "created_at": current["created_at"]
    }

def clear_canvas(background_color: str = "#ffffff") -> dict:
    """
    Clears the drawing canvas and creates a fresh blank canvas with the given background color.
    
    Args:
        background_color: Hex color string (e.g., '#ffffff', '#000000', '#1a1a2e').
    """
    record = canvas_manager.clear_canvas(background_color=background_color)
    return {
        "status": "success",
        "message": f"Canvas cleared with background color {background_color}",
        "drawing_id": record["id"]
    }

def list_drawing_history() -> dict:
    """
    Lists all drawings created during this and previous sessions.
    """
    drawings = canvas_manager.get_all_drawings()
    return {
        "count": len(drawings),
        "drawings": [
            {
                "id": d["id"],
                "title": d["title"],
                "description": d["description"],
                "type": d["type"],
                "created_at": d["created_at"]
            }
            for d in drawings
        ]
    }
