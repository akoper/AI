// Frontend logic for Gemini RAG Agent Studio

const statDocs = document.getElementById('stat-docs');
const statChunks = document.getElementById('stat-chunks');
const statModel = document.getElementById('stat-model');
const chunksList = document.getElementById('chunks-list');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const queryInput = document.getElementById('query-input');
const btnAddDoc = document.getElementById('btn-add-doc');
const docTitle = document.getElementById('doc-title');
const docContent = document.getElementById('doc-content');
const btnRefreshDocs = document.getElementById('btn-refresh-docs');
const btnClearDocs = document.getElementById('btn-clear-docs');
const btnClearChat = document.getElementById('btn-clear-chat');
const paramTopK = document.getElementById('param-topk');
const valTopK = document.getElementById('val-topk');
const paramThreshold = document.getElementById('param-threshold');
const valThreshold = document.getElementById('val-threshold');

// Update parameter labels
paramTopK.addEventListener('input', () => {
  valTopK.textContent = paramTopK.value;
});
paramThreshold.addEventListener('input', () => {
  valThreshold.textContent = paramThreshold.value;
});

// Load stats and documents
async function loadHealthAndStats() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    statDocs.textContent = data.stats.documentsCount;
    statChunks.textContent = data.stats.chunksCount;
    statModel.textContent = `Model: ${data.model}`;
  } catch (err) {
    console.error('Health check failed', err);
  }
}

async function loadDocumentsList() {
  try {
    const res = await fetch('/api/documents');
    const data = await res.json();
    statDocs.textContent = data.stats.documentsCount;
    statChunks.textContent = data.stats.chunksCount;

    chunksList.innerHTML = '';
    if (data.chunks.length === 0) {
      chunksList.innerHTML = '<div style="color: #64748b; font-size: 0.75rem; padding: 8px;">No chunks indexed yet.</div>';
      return;
    }

    data.chunks.forEach((chunk) => {
      const el = document.createElement('div');
      el.className = 'chunk-badge';
      el.innerHTML = `
        <div class="chunk-source">${escapeHtml(chunk.title || chunk.source)} [Chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}]</div>
        <div class="chunk-snippet">${escapeHtml(chunk.snippet)}</div>
      `;
      chunksList.appendChild(el);
    });
  } catch (err) {
    console.error('Error fetching documents list', err);
  }
}

// Ingest document
btnAddDoc.addEventListener('click', async () => {
  const title = docTitle.value.trim();
  const text = docContent.value.trim();
  if (!text) {
    alert('Please enter document content to ingest');
    return;
  }

  btnAddDoc.disabled = true;
  btnAddDoc.textContent = '⏳ Ingesting...';

  try {
    const res = await fetch('/api/documents/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, title: title || 'Custom Note', source: title || 'User Note' }),
    });
    const result = await res.json();
    if (result.success) {
      docTitle.value = '';
      docContent.value = '';
      await loadDocumentsList();
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (err) {
    alert(`Failed to ingest document: ${err.message}`);
  } finally {
    btnAddDoc.disabled = false;
    btnAddDoc.innerHTML = '<span>📥 Ingest Document</span>';
  }
});

btnRefreshDocs.addEventListener('click', loadDocumentsList);

btnClearDocs.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to delete all indexed knowledge?')) return;
  try {
    await fetch('/api/documents', { method: 'DELETE' });
    await loadDocumentsList();
  } catch (err) {
    alert(`Error clearing documents: ${err.message}`);
  }
});

btnClearChat.addEventListener('click', async () => {
  try {
    await fetch('/api/history', { method: 'DELETE' });
    chatMessages.innerHTML = `
      <div class="message assistant welcome-message">
        <div class="avatar">🤖</div>
        <div class="message-content">
          <p><strong>Chat history cleared!</strong></p>
          <p>Ask a question about the indexed knowledge base.</p>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Error clearing chat', err);
  }
});

// Chat submit handler
chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  // Append user message
  appendMessage('user', query);
  queryInput.value = '';

  // Append loading placeholder
  const botMessageEl = appendMessage('assistant', 'Searching knowledge & generating response...', true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        topK: parseInt(paramTopK.value, 10),
        similarityThreshold: parseFloat(paramThreshold.value),
      }),
    });

    const data = await res.json();
    if (data.error) {
      botMessageEl.querySelector('.message-content').innerHTML = `<p style="color: #ef4444;">Error: ${escapeHtml(data.error)}</p>`;
      return;
    }

    let html = `<p>${formatMarkdown(data.answer)}</p>`;

    if (data.citations && data.citations.length > 0) {
      html += `
        <div class="citations-container">
          <div class="citations-title">📚 Retrieved Sources (${data.retrievedChunksCount} chunks | ${(data.confidence * 100).toFixed(0)}% match)</div>
          ${data.citations
            .map(
              (c, i) => `
            <div class="citation-chip">
              <strong>[Source ${i + 1}]</strong> ${escapeHtml(c.source)} (score: ${(c.score * 100).toFixed(1)}%)
              <div><em>"${escapeHtml(c.snippet)}"</em></div>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    }

    botMessageEl.querySelector('.message-content').innerHTML = html;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  } catch (err) {
    botMessageEl.querySelector('.message-content').innerHTML = `<p style="color: #ef4444;">Failed to get response: ${escapeHtml(err.message)}</p>`;
  }
});

function appendMessage(role, text, isLoading = false) {
  const msg = document.createElement('div');
  msg.className = `message ${role}`;
  msg.innerHTML = `
    <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="message-content">
      <p>${isLoading ? `<em>${escapeHtml(text)}</em>` : formatMarkdown(text)}</p>
    </div>
  `;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msg;
}

window.askSample = function (text) {
  queryInput.value = text;
  chatForm.dispatchEvent(new Event('submit'));
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatMarkdown(text) {
  if (!text) return '';
  let formatted = escapeHtml(text);
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
  formatted = formatted.replace(/\n\n/g, '</p><p>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

// Initial load
loadHealthAndStats();
loadDocumentsList();
