// Frontend Application Logic for Gemini Multi-Agent System

let ws = null;
let currentTaskId = null;
const state = {
  agents: [],
  subtasks: [],
  artifacts: new Map(),
  events: [],
};

// DOM Elements
const taskInput = document.getElementById('taskInput');
const workflowSelect = document.getElementById('workflowSelect');
const runBtn = document.getElementById('runBtn');
const agentsGrid = document.getElementById('agentsGrid');
const artifactsList = document.getElementById('artifactsList');
const subtasksTimeline = document.getElementById('subtasksTimeline');
const streamFeed = document.getElementById('streamFeed');
const clearStreamBtn = document.getElementById('clearStreamBtn');
const deliverableCard = document.getElementById('deliverableCard');
const finalOutputContent = document.getElementById('finalOutputContent');
const taskMetrics = document.getElementById('taskMetrics');
const statusText = document.getElementById('statusText');
const connectionStatus = document.getElementById('connectionStatus');
const artifactModal = document.getElementById('artifactModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupWebSocket();
  fetchStatus();
  fetchAgents();
  setupEventListeners();
});

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws/stream`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    statusText.innerText = 'System Connected';
    connectionStatus.querySelector('.status-dot').className = 'status-dot online';
  };

  ws.onclose = () => {
    statusText.innerText = 'Disconnected (Reconnecting...)';
    connectionStatus.querySelector('.status-dot').className = 'status-dot';
    setTimeout(setupWebSocket, 3000);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'event') {
        handleTraceEvent(data.payload);
      } else if (data.type === 'task_result') {
        renderTaskResult(data.payload);
      }
    } catch (e) {
      console.error('Failed to parse WS message', e);
    }
  };
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('modelBadge').innerText = data.model;
  } catch (err) {
    console.warn('Status check error', err);
  }
}

async function fetchAgents() {
  try {
    const res = await fetch('/api/agents');
    const data = await res.json();
    state.agents = data.agents;
    renderAgents(data.agents);
  } catch (err) {
    console.error('Failed to load agents', err);
  }
}

function renderAgents(agents) {
  agentsGrid.innerHTML = agents
    .map(
      (agent) => `
    <div class="agent-badge" style="border-left: 3px solid ${agent.color || '#6366f1'}">
      <div class="agent-avatar">${agent.avatar || '🤖'}</div>
      <div class="agent-info">
        <div class="agent-name" style="color: ${agent.color || '#fff'}">
          ${agent.name}
        </div>
        <div class="agent-role">${agent.role}</div>
        <div class="agent-tools">
          ${agent.tools.map((t) => `<span class="tool-tag">${t}</span>`).join('')}
        </div>
      </div>
    </div>
  `
    )
    .join('');
}

function setupEventListeners() {
  runBtn.addEventListener('click', handleRunTask);

  clearStreamBtn.addEventListener('click', () => {
    streamFeed.innerHTML = '<div class="stream-placeholder">Log cleared. Ready for next mission.</div>';
  });

  document.querySelectorAll('.quick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      taskInput.value = btn.getAttribute('data-task') || '';
    });
  });

  closeModalBtn.addEventListener('click', () => {
    artifactModal.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (e.target === artifactModal) {
      artifactModal.style.display = 'none';
    }
  });
}

async function handleRunTask() {
  const task = taskInput.value.trim();
  if (!task) return;

  const workflowType = workflowSelect.value;
  runBtn.disabled = true;
  runBtn.innerHTML = '<span class="btn-icon">⏳</span> Agents Collaborating...';
  deliverableCard.style.display = 'none';

  // Clear timeline & stream
  subtasksTimeline.innerHTML = '';
  streamFeed.innerHTML = '';
  state.artifacts.clear();
  renderArtifacts();

  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, workflowType }),
    });

    const data = await res.json();
    if (data.success) {
      renderTaskResult(data.result);
    }
  } catch (err) {
    console.error('Task execution error', err);
  } finally {
    runBtn.disabled = false;
    runBtn.innerHTML = '<span class="btn-icon">⚡</span> Execute Multi-Agent System';
  }
}

function handleTraceEvent(evt) {
  state.events.push(evt);

  // 1. Subtasks update
  if (evt.type === 'subtask_created' || evt.type === 'subtask_started' || evt.type === 'subtask_completed') {
    const sub = evt.data.subtask;
    const existingIndex = state.subtasks.findIndex((s) => s.id === sub.id);
    if (existingIndex >= 0) {
      state.subtasks[existingIndex] = sub;
    } else {
      state.subtasks.push(sub);
    }
    renderSubtasks();
  }

  // 2. Artifacts update
  if (evt.type === 'artifact_created' || evt.type === 'artifact_updated') {
    const art = evt.data.artifact;
    state.artifacts.set(art.name, art);
    renderArtifacts();
  }

  // 3. Stream item
  appendStreamItem(evt);
}

function appendStreamItem(evt) {
  const time = new Date(evt.timestamp).toLocaleTimeString();
  const item = document.createElement('div');
  item.className = 'stream-item';

  const agentObj = state.agents.find((a) => a.name === evt.agent);
  const avatar = agentObj?.avatar || '🤖';
  const color = agentObj?.color || '#a5b4fc';

  if (evt.type === 'agent_thought') {
    item.innerHTML = `
      <div class="stream-item-header">
        <span class="stream-agent-tag" style="color: ${color}">${avatar} ${evt.agent}</span>
        <span class="stream-time">${time}</span>
      </div>
      <div class="thought-box">💭 ${evt.data.thought}</div>
    `;
  } else if (evt.type === 'tool_called') {
    item.innerHTML = `
      <div class="stream-item-header">
        <span class="stream-agent-tag" style="color: ${color}">${avatar} ${evt.agent}</span>
        <span class="stream-time">${time}</span>
      </div>
      <div class="tool-box">⚡ Invocating Tool: <strong>${evt.data.tool}</strong> ${JSON.stringify(evt.data.args)}</div>
    `;
  } else if (evt.type === 'agent_handoff') {
    item.className = 'stream-item stream-handoff';
    item.innerHTML = `🔀 Autonomous Handoff: <strong>${evt.data.from}</strong> ➔ <strong>${evt.data.to}</strong>`;
  } else if (evt.type === 'agent_message') {
    const msg = evt.data.message;
    item.innerHTML = `
      <div class="stream-item-header">
        <span class="stream-agent-tag" style="color: ${color}">${avatar} ${evt.agent}</span>
        <span class="stream-time">${time}</span>
      </div>
      ${msg.thought ? `<div class="thought-box">💭 ${msg.thought}</div>` : ''}
      <div class="stream-content">${escapeHtml(msg.content)}</div>
    `;
  } else {
    return;
  }

  streamFeed.appendChild(item);
  streamFeed.scrollTop = streamFeed.scrollHeight;
}

function renderSubtasks() {
  if (state.subtasks.length === 0) {
    subtasksTimeline.innerHTML = '<div class="empty-state">No subtasks registered.</div>';
    return;
  }

  subtasksTimeline.innerHTML = state.subtasks
    .map(
      (sub) => `
    <div class="subtask-row">
      <div class="subtask-left">
        <span class="subtask-status-icon">${sub.status === 'completed' ? '✅' : sub.status === 'in_progress' ? '⏳' : '⚪'}</span>
        <div>
          <strong>${escapeHtml(sub.title)}</strong>
          <span style="color: var(--text-dim); font-size: 11px; margin-left: 6px;">(${sub.assignedAgent})</span>
        </div>
      </div>
      <span class="status-badge ${sub.status}">${sub.status.replace('_', ' ')}</span>
    </div>
  `
    )
    .join('');
}

function renderArtifacts() {
  const artifacts = Array.from(state.artifacts.values());
  if (artifacts.length === 0) {
    artifactsList.innerHTML = '<div class="empty-state">No artifacts in shared blackboard.</div>';
    return;
  }

  artifactsList.innerHTML = artifacts
    .map(
      (art) => `
    <div class="artifact-item" onclick="openArtifactModal('${art.name}')">
      <div>
        <div class="artifact-name">${art.name}</div>
        <div class="artifact-meta">By ${art.createdBy} • ${art.type} • v${art.version}</div>
      </div>
      <span style="font-size: 11px; color: #a5b4fc;">View ↗</span>
    </div>
  `
    )
    .join('');
}

window.openArtifactModal = function (name) {
  const art = state.artifacts.get(name);
  if (!art) return;
  modalTitle.innerText = `Artifact: ${art.name} (v${art.version} by ${art.createdBy})`;
  modalBody.innerText = art.content;
  artifactModal.style.display = 'flex';
};

function renderTaskResult(result) {
  deliverableCard.style.display = 'block';
  finalOutputContent.innerText = result.finalAnswer;

  taskMetrics.innerHTML = `
    <span class="status-badge completed">Duration: ${result.durationMs}ms</span>
    <span class="status-badge completed">${result.metrics.totalMessages} Messages</span>
    <span class="status-badge completed">${result.metrics.totalToolCalls} Tool Invocations</span>
  `;

  // Render any remaining artifacts & subtasks
  if (result.artifacts) {
    result.artifacts.forEach((a) => state.artifacts.set(a.name, a));
    renderArtifacts();
  }
  if (result.subtasks) {
    state.subtasks = result.subtasks;
    renderSubtasks();
  }

  deliverableCard.scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
