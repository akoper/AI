document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const seedSampleBtn = document.getElementById('seedSampleBtn');
  const clearDocsBtn = document.getElementById('clearDocsBtn');
  const refreshDocsBtn = document.getElementById('refreshDocsBtn');
  const addDocForm = document.getElementById('addDocForm');
  const docTitleInput = document.getElementById('docTitle');
  const docContentInput = document.getElementById('docContent');
  const chunkSizeInput = document.getElementById('chunkSize');
  const chunkOverlapInput = document.getElementById('chunkOverlap');
  const docCountSpan = document.getElementById('docCount');
  const chunkCountSpan = document.getElementById('chunkCount');
  const documentsList = document.getElementById('documentsList');
  const exampleDocSelect = document.getElementById('exampleDocSelect');
  const exampleQuestionsBox = document.getElementById('exampleQuestionsBox');
  const suggestedQuestionsList = document.getElementById('suggestedQuestionsList');

  const ragQueryForm = document.getElementById('ragQueryForm');
  const queryInput = document.getElementById('queryInput');
  const topKSelect = document.getElementById('topK');
  const simThresholdInput = document.getElementById('simThreshold');
  const queryLoading = document.getElementById('queryLoading');
  const ragResultArea = document.getElementById('ragResultArea');
  const geminiAnswerText = document.getElementById('geminiAnswerText');
  const retrievedSourcesList = document.getElementById('retrievedSourcesList');
  const pipelineStepsList = document.getElementById('pipelineStepsList');

  // Load API key from localStorage if saved
  const savedApiKey = localStorage.getItem('GEMINI_API_KEY');
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('GEMINI_API_KEY', key);
      alert('API Key saved in browser local storage!');
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
      alert('API Key cleared from local storage. Server .env will be used if present.');
    }
  });

  function getApiKey() {
    return apiKeyInput.value.trim() || localStorage.getItem('GEMINI_API_KEY') || null;
  }

  // Fetch status and render knowledge base documents
  async function loadKnowledgeBase() {
    try {
      const res = await fetch('/api/rag/status');
      const data = await res.json();

      docCountSpan.textContent = data.totalDocuments;
      chunkCountSpan.textContent = data.totalChunks;

      if (!data.documents || data.documents.length === 0) {
        documentsList.innerHTML = `<p class="empty-text">No documents in knowledge base yet. Click "🌱 Seed Sample Docs" above to load tutorial data or add your own.</p>`;
        return;
      }

      documentsList.innerHTML = data.documents.map(doc => `
        <div class="doc-item">
          <div class="doc-item-header">
            <span class="doc-item-title">${escapeHtml(doc.title)}</span>
            <span class="badge">${doc.chunkCount} chunk${doc.chunkCount === 1 ? '' : 's'}</span>
          </div>
          <div class="doc-item-content">${escapeHtml(doc.content.slice(0, 160))}...</div>
        </div>
      `).join('');
    } catch (err) {
      console.error(err);
      documentsList.innerHTML = `<p class="empty-text" style="color:var(--danger)">Failed to load knowledge base: ${err.message}</p>`;
    }
  }

  // Seed sample documents
  seedSampleBtn.addEventListener('click', async () => {
    try {
      seedSampleBtn.disabled = true;
      seedSampleBtn.textContent = '⏳ Vectorizing...';
      const res = await fetch('/api/rag/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: getApiKey() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to seed');

      alert(data.message);
      await loadKnowledgeBase();
    } catch (err) {
      alert('Error seeding knowledge base: ' + err.message);
    } finally {
      seedSampleBtn.disabled = false;
      seedSampleBtn.textContent = '🌱 Seed Sample Docs';
    }
  });

  // Clear Knowledge base
  clearDocsBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all indexed documents and vector embeddings?')) return;
    try {
      await fetch('/api/rag/clear', { method: 'POST' });
      await loadKnowledgeBase();
    } catch (err) {
      alert('Error clearing: ' + err.message);
    }
  });

  refreshDocsBtn.addEventListener('click', loadKnowledgeBase);

  // Ingest document form submission
  addDocForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = docTitleInput.value.trim();
    const content = docContentInput.value.trim();
    const chunkSize = parseInt(chunkSizeInput.value) || 250;
    const overlap = parseInt(chunkOverlapInput.value) || 40;

    if (!title || !content) return;

    const submitBtn = addDocForm.querySelector('button[type="submit"]');
    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Vectorizing with Gemini...';

      const res = await fetch('/api/rag/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          chunkSize,
          overlap,
          apiKey: getApiKey()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest');

      docTitleInput.value = '';
      docContentInput.value = '';
      alert(`Success: "${data.result.title}" indexed into ${data.result.chunkCount} semantic vector chunks!`);
      await loadKnowledgeBase();
    } catch (err) {
      alert('Ingestion error: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '⚡ Chunk, Vectorize & Index';
    }
  });

  // Execute RAG Query
  ragQueryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    const topK = parseInt(topKSelect.value) || 3;
    const similarityThreshold = parseFloat(simThresholdInput.value) || 0.0;

    if (!query) return;

    queryLoading.style.display = 'flex';
    ragResultArea.style.display = 'none';

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          topK,
          similarityThreshold,
          apiKey: getApiKey()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'RAG Query failed');

      renderRAGResults(data);
    } catch (err) {
      alert('RAG Error: ' + err.message);
    } finally {
      queryLoading.style.display = 'none';
    }
  });

  function renderRAGResults(data) {
    ragResultArea.style.display = 'block';
    geminiAnswerText.textContent = data.answer;
    const modelBadge = document.getElementById('modelBadge');
    if (modelBadge && data.metadata && data.metadata.modelUsed) {
      modelBadge.textContent = data.metadata.modelUsed;
    }

    // Render retrieved chunks
    if (!data.retrievedChunks || data.retrievedChunks.length === 0) {
      retrievedSourcesList.innerHTML = `<p class="empty-text">No chunks matched the similarity criteria.</p>`;
    } else {
      retrievedSourcesList.innerHTML = data.retrievedChunks.map((chunk, idx) => `
        <div class="source-chip">
          <div class="source-chip-title">
            <span>[Source #${idx + 1}] ${escapeHtml(chunk.source)}</span>
            <span class="badge badge-score">Cosine Similarity: ${(chunk.score * 100).toFixed(1)}%</span>
          </div>
          <div style="color:var(--text-muted); font-size:0.78rem;">${escapeHtml(chunk.content)}</div>
        </div>
      `).join('');
    }

    // Render step-by-step breakdown
    pipelineStepsList.innerHTML = data.steps.map(step => `
      <div class="step-item">
        <div class="step-item-header">
          <span>Step ${step.step}: ${escapeHtml(step.name)}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">▼ inspect</span>
        </div>
        <div class="step-item-body"><strong>${escapeHtml(step.description)}</strong>\n\n${escapeHtml(JSON.stringify(step.details, null, 2))}</div>
      </div>
    `).join('');

    // Accordion toggle handler
    const headers = pipelineStepsList.querySelectorAll('.step-item-header');
    headers.forEach(h => {
      h.addEventListener('click', () => {
        const body = h.nextElementSibling;
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
      });
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  let availableExamples = [];

  // Load example documents from server
  async function loadExamples() {
    try {
      const res = await fetch('/api/rag/examples');
      const data = await res.json();
      if (data.examples && data.examples.length > 0) {
        availableExamples = data.examples;
        exampleDocSelect.innerHTML = '<option value="">-- Choose Example Template --</option>' +
          data.examples.map(ex => `<option value="${escapeHtml(ex.id)}">${escapeHtml(ex.category ? `[${ex.category}] ` : '')}${escapeHtml(ex.title)}</option>`).join('');
      }
    } catch (e) {
      console.warn('Could not load examples:', e);
    }
  }

  // Handle example selection
  if (exampleDocSelect) {
    exampleDocSelect.addEventListener('change', () => {
      const selectedId = exampleDocSelect.value;
      if (!selectedId) {
        exampleQuestionsBox.style.display = 'none';
        return;
      }
      const ex = availableExamples.find(item => item.id === selectedId);
      if (ex) {
        docTitleInput.value = ex.title;
        docContentInput.value = ex.content;

        if (ex.suggestedQuestions && ex.suggestedQuestions.length > 0) {
          suggestedQuestionsList.innerHTML = ex.suggestedQuestions.map(q => `
            <button type="button" class="question-chip" data-question="${escapeHtml(q)}">❓ ${escapeHtml(q)}</button>
          `).join('');
          exampleQuestionsBox.style.display = 'block';

          // Click handler to populate query input
          suggestedQuestionsList.querySelectorAll('.question-chip').forEach(btn => {
            btn.addEventListener('click', () => {
              queryInput.value = btn.getAttribute('data-question');
              queryInput.focus();
              queryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          });
        } else {
          exampleQuestionsBox.style.display = 'none';
        }
      }
    });
  }

  // Initial load
  loadKnowledgeBase();
  loadExamples();
});
