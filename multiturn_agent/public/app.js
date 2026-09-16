// Nexus Multi-Turn Agent Web Client
let ws = null;
let currentSessionId = null;
let currentSessionData = null;
let activeStreams = new Map();

// DOM Elements
const sessionListEl = document.getElementById('sessionList');
const currentSessionTitleEl = document.getElementById('currentSessionTitle');
const turnCounterEl = document.getElementById('turnCounter');
const forkInfoEl = document.getElementById('forkInfo');
const messagesContainerEl = document.getElementById('messagesContainer');
const emptyStateEl = document.getElementById('emptyState');
const toolStatusBarEl = document.getElementById('toolExecutionStatus');
const toolStatusTextEl = document.getElementById('toolStatusText');
const chatFormEl = document.getElementById('chatForm');
const chatInputEl = document.getElementById('chatInput');
const btnNewChatEl = document.getElementById('btnNewChat');
const btnForkSessionEl = document.getElementById('btnForkSession');
const btnExportSessionEl = document.getElementById('btnExportSession');
const btnClearHistoryEl = document.getElementById('btnClearHistory');
const btnOpenSettingsEl = document.getElementById('btnOpenSettings');
const settingsModalEl = document.getElementById('settingsModal');
const btnCloseSettingsEl = document.getElementById('btnCloseSettings');
const btnSaveSettingsEl = document.getElementById('btnSaveSettings');
const settingModelEl = document.getElementById('settingModel');
const settingTempEl = document.getElementById('settingTemp');
const tempValueEl = document.getElementById('tempValue');
const settingSystemEl = document.getElementById('settingSystem');
const agentModelBadgeEl = document.getElementById('agentModelBadge');

// Markdown Rendering Configuration
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

function renderMarkdown(text) {
  if (window.marked) {
    return marked.parse(text || '');
  }
  return escapeHtml(text || '').replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/chat`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Nexus WebSocket');
    if (currentSessionId) {
      ws.send(JSON.stringify({ type: 'init', sessionId: currentSessionId }));
    }
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleServerMessage(msg);
    } catch (err) {
      console.error('Error parsing WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    console.warn('WebSocket connection closed. Reconnecting in 3s...');
    setTimeout(initWebSocket, 3000);
  };
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'session_init':
      currentSessionData = msg.data;
      renderCurrentSession();
      loadSessionsList();
      break;

    case 'tool_call_start':
      toolStatusBarEl.classList.remove('hidden');
      toolStatusTextEl.textContent = `Executing tool [${msg.data.toolName}]...`;
      break;

    case 'tool_call_result':
      toolStatusTextEl.textContent = `Tool [${msg.data.toolName}] returned in ${msg.data.durationMs}ms`;
      setTimeout(() => {
        toolStatusBarEl.classList.add('hidden');
      }, 1500);
      break;

    case 'stream_delta':
      updateStreamingBubble(msg.data.fullText);
      break;

    case 'turn_complete':
      toolStatusBarEl.classList.add('hidden');
      removeStreamingBubble();
      if (msg.data && msg.data.sessionId === currentSessionId) {
        fetchSessionDetails(currentSessionId);
      }
      break;

    case 'session_cleared':
    case 'session_forked':
      if (msg.sessionId) {
        currentSessionId = msg.sessionId;
        fetchSessionDetails(currentSessionId);
        loadSessionsList();
      }
      break;

    case 'error':
      toolStatusBarEl.classList.add('hidden');
      alert(`Agent error: ${msg.error}`);
      break;
  }
}

// REST API calls
async function loadSessionsList() {
  try {
    const res = await fetch('/api/sessions');
    const data = await res.json();
    renderSessionList(data.sessions || []);
  } catch (err) {
    console.error('Failed to load sessions:', err);
  }
}

async function createNewSession() {
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    currentSessionId = data.session.id;
    currentSessionData = data.session;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'init', sessionId: currentSessionId }));
    }
    renderCurrentSession();
    loadSessionsList();
  } catch (err) {
    console.error('Failed to create session:', err);
  }
}

async function fetchSessionDetails(id) {
  try {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) {
      const data = await res.json();
      currentSessionId = data.session.id;
      currentSessionData = data.session;
      renderCurrentSession();
      loadSessionsList();
    }
  } catch (err) {
    console.error('Failed to fetch session details:', err);
  }
}

function renderSessionList(sessions) {
  sessionListEl.innerHTML = '';
  if (sessions.length === 0) {
    sessionListEl.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text-dim);">No saved chats</div>';
    return;
  }

  for (const s of sessions) {
    const item = document.createElement('div');
    item.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="session-item-content">
        <span class="session-item-title">${escapeHtml(s.title || 'Untitled Chat')}</span>
        <span class="session-item-sub">${s.turnsCount} turns ${s.parentSessionId ? '• 🍴 Fork' : ''}</span>
      </div>
      <button class="btn-icon session-item-delete" title="Delete Session">&times;</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.session-item-delete')) {
        e.stopPropagation();
        deleteSession(s.id);
        return;
      }
      currentSessionId = s.id;
      fetchSessionDetails(s.id);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'init', sessionId: s.id }));
      }
    });

    sessionListEl.appendChild(item);
  }
}

async function deleteSession(id) {
  if (!confirm('Are you sure you want to delete this session?')) return;
  try {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (id === currentSessionId) {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (data.sessions && data.sessions.length > 0) {
        currentSessionId = data.sessions[0].id;
        fetchSessionDetails(currentSessionId);
      } else {
        createNewSession();
      }
    } else {
      loadSessionsList();
    }
  } catch (err) {
    console.error('Failed to delete session:', err);
  }
}

function renderCurrentSession() {
  if (!currentSessionData) return;

  currentSessionTitleEl.textContent = currentSessionData.title || 'New Multi-turn Chat';
  const turns = Math.ceil(currentSessionData.messages.length / 2);
  turnCounterEl.textContent = `${turns} turn${turns === 1 ? '' : 's'}`;

  if (currentSessionData.parentSessionId) {
    forkInfoEl.classList.remove('hidden');
    forkInfoEl.textContent = `Forked at Turn ${currentSessionData.forkedAtTurn ?? 'N'}`;
  } else {
    forkInfoEl.classList.add('hidden');
  }

  agentModelBadgeEl.textContent = currentSessionData.model || 'gemini-2.5-flash';

  // Render messages
  if (currentSessionData.messages.length === 0) {
    messagesContainerEl.innerHTML = '';
    messagesContainerEl.appendChild(emptyStateEl);
  } else {
    messagesContainerEl.innerHTML = '';
    for (const msg of currentSessionData.messages) {
      appendMessageElement(msg);
    }
    messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
  }
}

function appendMessageElement(msg) {
  const turnDiv = document.createElement('div');
  turnDiv.className = `message-turn ${msg.role === 'user' ? 'user' : 'model'}`;

  const headerDiv = document.createElement('div');
  headerDiv.className = 'turn-header';
  const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  headerDiv.innerHTML = `<span>${msg.role === 'user' ? '👤 You' : '🤖 Nexus'}</span> <span>• Turn ${msg.turnNumber}</span> <span>• ${timeStr}</span>`;

  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';

  // If message contains tool calls, render tool execution boxes
  if (msg.toolCalls && msg.toolCalls.length > 0) {
    const toolBox = document.createElement('div');
    toolBox.className = 'tool-executions-box';
    for (const tc of msg.toolCalls) {
      const toolCard = document.createElement('div');
      toolCard.className = 'tool-card';
      toolCard.innerHTML = `
        <div class="tool-card-header">
          <span>⚙️ ${escapeHtml(tc.name)}</span>
          <span style="font-size:11px;color:var(--text-dim);">${tc.durationMs ? tc.durationMs + 'ms' : ''}</span>
        </div>
        <div class="tool-card-body">Args: ${escapeHtml(JSON.stringify(tc.args, null, 2))}\nResult: ${escapeHtml(JSON.stringify(tc.result || tc.error, null, 2))}</div>
      `;
      toolBox.appendChild(toolCard);
    }
    bubbleDiv.appendChild(toolBox);
  }

  const textPart = msg.parts.find(p => p.text)?.text || '';
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = renderMarkdown(textPart);
  bubbleDiv.appendChild(contentDiv);

  turnDiv.appendChild(headerDiv);
  turnDiv.appendChild(bubbleDiv);
  messagesContainerEl.appendChild(turnDiv);
}

function updateStreamingBubble(fullText) {
  let streamBubble = document.getElementById('streamingAgentBubble');
  if (!streamBubble) {
    const turnDiv = document.createElement('div');
    turnDiv.id = 'streamingTurnDiv';
    turnDiv.className = 'message-turn model';

    const headerDiv = document.createElement('div');
    headerDiv.className = 'turn-header';
    headerDiv.innerHTML = `<span>🤖 Nexus</span> <span>• Generating...</span>`;

    streamBubble = document.createElement('div');
    streamBubble.id = 'streamingAgentBubble';
    streamBubble.className = 'message-bubble';

    turnDiv.appendChild(headerDiv);
    turnDiv.appendChild(streamBubble);
    messagesContainerEl.appendChild(turnDiv);
  }

  streamBubble.innerHTML = renderMarkdown(fullText);
  messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
}

function removeStreamingBubble() {
  const el = document.getElementById('streamingTurnDiv');
  if (el) el.remove();
}

// Send Message Handler
function sendMessage(text) {
  const prompt = text || chatInputEl.value.trim();
  if (!prompt || !currentSessionId) return;

  chatInputEl.value = '';
  chatInputEl.style.height = 'auto';

  // Optimistically append user message to UI
  const currentTurns = Math.floor((currentSessionData?.messages?.length || 0) / 2) + 1;
  appendMessageElement({
    id: `temp_${Date.now()}`,
    role: 'user',
    parts: [{ text: prompt }],
    timestamp: new Date().toISOString(),
    turnNumber: currentTurns,
  });
  messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;

  // Send via WebSocket
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'send_message',
      sessionId: currentSessionId,
      text: prompt,
    }));
  } else {
    // Fallback to REST message post
    fetch(`/api/sessions/${currentSessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
    }).then(() => fetchSessionDetails(currentSessionId));
  }
}

// UI Event Listeners
chatFormEl.addEventListener('submit', (e) => {
  e.preventDefault();
  sendMessage();
});

chatInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

chatInputEl.addEventListener('input', () => {
  chatInputEl.style.height = 'auto';
  chatInputEl.style.height = `${Math.min(chatInputEl.scrollHeight, 140)}px`;
});

btnNewChatEl.addEventListener('click', () => {
  createNewSession();
});

btnForkSessionEl.addEventListener('click', async () => {
  if (!currentSessionId) return;
  try {
    const res = await fetch(`/api/sessions/${currentSessionId}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    currentSessionId = data.session.id;
    currentSessionData = data.session;
    renderCurrentSession();
    loadSessionsList();
  } catch (err) {
    alert(`Failed to fork session: ${err.message}`);
  }
});

btnExportSessionEl.addEventListener('click', () => {
  if (!currentSessionId) return;
  window.open(`/api/sessions/${currentSessionId}/export`, '_blank');
});

btnClearHistoryEl.addEventListener('click', async () => {
  if (!currentSessionId) return;
  if (!confirm('Clear all conversation history in this session?')) return;
  try {
    const res = await fetch(`/api/sessions/${currentSessionId}/clear`, {
      method: 'POST',
    });
    const data = await res.json();
    currentSessionData = data.session;
    renderCurrentSession();
    loadSessionsList();
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
});

// Suggestions & Quick Pills
document.addEventListener('click', (e) => {
  const target = e.target.closest('.suggestion-btn, .pill');
  if (target && target.dataset.text) {
    sendMessage(target.dataset.text);
  }
});

// Settings Modal
btnOpenSettingsEl.addEventListener('click', () => {
  if (currentSessionData) {
    settingModelEl.value = currentSessionData.model || 'gemini-2.5-flash';
    settingTempEl.value = currentSessionData.temperature ?? 0.7;
    tempValueEl.textContent = settingTempEl.value;
    settingSystemEl.value = currentSessionData.systemInstruction || '';
  }
  settingsModalEl.classList.remove('hidden');
});

btnCloseSettingsEl.addEventListener('click', () => {
  settingsModalEl.classList.add('hidden');
});

settingTempEl.addEventListener('input', () => {
  tempValueEl.textContent = settingTempEl.value;
});

btnSaveSettingsEl.addEventListener('click', async () => {
  if (!currentSessionId) return;
  const updates = {
    model: settingModelEl.value,
    temperature: parseFloat(settingTempEl.value),
    systemInstruction: settingSystemEl.value,
  };
  try {
    const res = await fetch(`/api/sessions/${currentSessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    currentSessionData = data.session;
    settingsModalEl.classList.add('hidden');
    renderCurrentSession();
  } catch (err) {
    alert(`Failed to save settings: ${err.message}`);
  }
});

// Initial boot
initWebSocket();
loadSessionsList().then(async () => {
  const res = await fetch('/api/sessions');
  const data = await res.json();
  if (data.sessions && data.sessions.length > 0) {
    fetchSessionDetails(data.sessions[0].id);
  } else {
    createNewSession();
  }
});
