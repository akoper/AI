document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const promptInput = document.getElementById('promptInput');
  const sendBtn = document.getElementById('sendBtn');
  const statusBadge = document.getElementById('statusBadge');
  const statusText = document.getElementById('statusText');
  const galleryBtn = document.getElementById('galleryBtn');
  const galleryCount = document.getElementById('galleryCount');
  const clearBtn = document.getElementById('clearBtn');
  
  const currentDrawingTitle = document.getElementById('currentDrawingTitle');
  const currentDrawingMeta = document.getElementById('currentDrawingMeta');
  const viewVisualTab = document.getElementById('viewVisualTab');
  const viewCodeTab = document.getElementById('viewCodeTab');
  const visualContainer = document.getElementById('visualContainer');
  const codeContainer = document.getElementById('codeContainer');
  const drawingPlaceholder = document.getElementById('drawingPlaceholder');
  const svgWrapper = document.getElementById('svgWrapper');
  const rasterImage = document.getElementById('rasterImage');
  const svgCodeDisplay = document.getElementById('svgCodeDisplay');
  
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const resetZoomBtn = document.getElementById('resetZoomBtn');
  const zoomLevelText = document.getElementById('zoomLevelText');
  const downloadSvgBtn = document.getElementById('downloadSvgBtn');
  const downloadPngBtn = document.getElementById('downloadPngBtn');
  
  const galleryModal = document.getElementById('galleryModal');
  const closeGalleryBtn = document.getElementById('closeGalleryBtn');
  const galleryGrid = document.getElementById('galleryGrid');

  // State
  let currentDrawing = null;
  let zoomScale = 1.0;
  const sessionId = 'session_' + Math.random().toString(36).substring(2, 9);

  // Initialize
  checkStatus();
  loadCurrentDrawing();
  updateGalleryCount();

  // Status check
  async function checkStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();
      if (data.has_api_key) {
        statusBadge.className = 'status-indicator ready';
        statusText.textContent = `Connected (${data.model})`;
      } else {
        statusBadge.className = 'status-indicator offline';
        statusText.textContent = 'Demo Mode (No API Key)';
      }
    } catch (e) {
      statusBadge.className = 'status-indicator offline';
      statusText.textContent = 'Offline';
    }
  }

  // Auto-resize input & enter submission
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Suggestion chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      promptInput.value = chip.getAttribute('data-prompt');
      promptInput.focus();
    });
  });

  // Chat Form Submit
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = promptInput.value.trim();
    if (!message) return;

    // Append User Message
    appendMessage('user', message);
    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Loading indicator
    const loadingMessage = appendLoadingMessage();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, session_id: sessionId })
      });

      const data = await res.json();
      loadingMessage.remove();

      if (data.response) {
        appendMessage('assistant', data.response);
      }

      if (data.drawing) {
        displayDrawing(data.drawing);
        updateGalleryCount();
      }
    } catch (err) {
      loadingMessage.remove();
      appendMessage('assistant', `⚠️ Error communicating with the drawing agent: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      promptInput.focus();
    }
  });

  function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? '👤' : '🎨';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Parse basic markdown bold and bullet points
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;">$1</code>')
      .replace(/\n/g, '<br/>');

    bubble.innerHTML = `<p>${formatted}</p>`;
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }

  function appendLoadingMessage() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message assistant';
    msgDiv.innerHTML = `
      <div class="avatar">🎨</div>
      <div class="bubble">
        <p style="color:var(--text-muted);">✨ Gemini is designing and drawing your artwork...</p>
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
  }

  // Display Drawing on Canvas
  function displayDrawing(drawing) {
    currentDrawing = drawing;
    currentDrawingTitle.textContent = drawing.title || 'Untitled Artwork';
    currentDrawingMeta.textContent = `${drawing.type.toUpperCase()} • ${drawing.created_at || 'Just now'}`;

    drawingPlaceholder.style.display = 'none';

    if (drawing.type === 'svg' && drawing.svg_content) {
      svgWrapper.innerHTML = drawing.svg_content;
      svgWrapper.style.display = 'flex';
      rasterImage.style.display = 'none';
      svgCodeDisplay.textContent = drawing.svg_content;
      downloadSvgBtn.disabled = false;
    } else if (drawing.png_file) {
      svgWrapper.style.display = 'none';
      rasterImage.src = '/' + drawing.png_file.replace(/\\/g, '/');
      rasterImage.style.display = 'block';
      svgCodeDisplay.textContent = '<!-- Bitmap / Raster Artwork -->';
      downloadSvgBtn.disabled = true;
    }

    downloadPngBtn.disabled = false;
    setZoom(1.0);
  }

  async function loadCurrentDrawing() {
    try {
      const res = await fetch('/api/current-drawing');
      const data = await res.json();
      if (data.drawing) {
        displayDrawing(data.drawing);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Tabs switching
  viewVisualTab.addEventListener('click', () => {
    viewVisualTab.classList.add('active');
    viewCodeTab.classList.remove('active');
    visualContainer.style.display = 'flex';
    codeContainer.style.display = 'none';
  });

  viewCodeTab.addEventListener('click', () => {
    viewCodeTab.classList.add('active');
    viewVisualTab.classList.remove('active');
    visualContainer.style.display = 'none';
    codeContainer.style.display = 'block';
  });

  // Zoom Controls
  function setZoom(scale) {
    zoomScale = Math.min(Math.max(scale, 0.2), 4.0);
    zoomLevelText.textContent = `${Math.round(zoomScale * 100)}%`;
    svgWrapper.style.transform = `scale(${zoomScale})`;
    rasterImage.style.transform = `scale(${zoomScale})`;
  }

  zoomInBtn.addEventListener('click', () => setZoom(zoomScale + 0.2));
  zoomOutBtn.addEventListener('click', () => setZoom(zoomScale - 0.2));
  resetZoomBtn.addEventListener('click', () => setZoom(1.0));

  // Downloads
  downloadSvgBtn.addEventListener('click', () => {
    if (!currentDrawing || !currentDrawing.svg_content) return;
    const blob = new Blob([currentDrawing.svg_content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentDrawing.id || 'artwork'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  });

  downloadPngBtn.addEventListener('click', () => {
    if (!currentDrawing) return;
    if (currentDrawing.png_file) {
      const a = document.createElement('a');
      a.href = '/' + currentDrawing.png_file.replace(/\\/g, '/');
      a.download = `${currentDrawing.id || 'artwork'}.png`;
      a.click();
    } else if (currentDrawing.svg_content) {
      // SVG to PNG via Canvas fallback in browser
      const svgBlob = new Blob([currentDrawing.svg_content], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 1200;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1600, 1200);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `${currentDrawing.id || 'artwork'}.png`;
        a.click();
      };
      img.src = blobURL;
    }
  });

  // Clear Canvas
  clearBtn.addEventListener('click', async () => {
    if (confirm('Clear the canvas and start a new artwork?')) {
      try {
        const res = await fetch('/api/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ background_color: '#0f172a' })
        });
        const data = await res.json();
        if (data.drawing) {
          displayDrawing(data.drawing);
          appendMessage('assistant', 'I have cleared the canvas. What would you like to draw next?');
        }
      } catch (e) {
        console.error(e);
      }
    }
  });

  // Gallery Modal
  galleryBtn.addEventListener('click', async () => {
    galleryModal.classList.add('active');
    await loadGallery();
  });

  closeGalleryBtn.addEventListener('click', () => {
    galleryModal.classList.remove('active');
  });

  window.addEventListener('click', (e) => {
    if (e.target === galleryModal) {
      galleryModal.classList.remove('active');
    }
  });

  async function updateGalleryCount() {
    try {
      const res = await fetch('/api/drawings');
      const data = await res.json();
      galleryCount.textContent = data.drawings ? data.drawings.length : 0;
    } catch (e) {}
  }

  async function loadGallery() {
    galleryGrid.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;">Loading gallery...</div>';
    try {
      const res = await fetch('/api/drawings');
      const data = await res.json();
      const drawings = data.drawings || [];

      if (drawings.length === 0) {
        galleryGrid.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px;">No drawings created yet!</div>';
        return;
      }

      galleryGrid.innerHTML = '';
      drawings.slice().reverse().forEach(d => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        
        let previewHtml = '';
        if (d.svg_content) {
          previewHtml = `<div class="gallery-preview">${d.svg_content}</div>`;
        } else if (d.png_file) {
          previewHtml = `<div class="gallery-preview"><img src="/${d.png_file.replace(/\\/g, '/')}" alt="${d.title}"/></div>`;
        } else {
          previewHtml = `<div class="gallery-preview">🎨</div>`;
        }

        card.innerHTML = `
          ${previewHtml}
          <div class="gallery-info">
            <div class="gallery-title">${d.title || 'Untitled'}</div>
            <div class="gallery-date">${d.created_at || ''}</div>
          </div>
        `;

        card.addEventListener('click', () => {
          displayDrawing(d);
          galleryModal.classList.remove('active');
        });

        galleryGrid.appendChild(card);
      });
    } catch (e) {
      galleryGrid.innerHTML = `<div style="color:var(--danger);grid-column:1/-1;">Failed to load gallery: ${e.message}</div>`;
    }
  }
});
