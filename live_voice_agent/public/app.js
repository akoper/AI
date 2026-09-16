// Live Voice Agent Frontend Application
document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const connectionStatus = document.getElementById('connection-status');
  const statusLabel = connectionStatus.querySelector('.status-label');
  const micBtn = document.getElementById('mic-btn');
  const micStatusBadge = document.getElementById('mic-status-badge');
  const micHint = document.getElementById('mic-hint');
  const visualizerCanvas = document.getElementById('visualizer-canvas');
  const messagesContainer = document.getElementById('messages-container');
  const textInputForm = document.getElementById('text-input-form');
  const textInput = document.getElementById('text-input');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const ttsToggleBtn = document.getElementById('tts-toggle-btn');
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const agentNameInput = document.getElementById('agent-name-input');
  const agentPersonaInput = document.getElementById('agent-persona-input');
  const modelSelect = document.getElementById('model-select');
  const voiceSelect = document.getElementById('voice-select');
  const promptChips = document.querySelectorAll('.prompt-chip');

  // Application State
  let ws = null;
  let isConnected = false;
  let isRecording = false;
  let audioContext = null;
  let mediaStream = null;
  let audioSource = null;
  let scriptProcessor = null;
  let analyser = null;
  let ttsEnabled = true;
  let currentThinkingElement = null;
  let voices = [];
  let selectedVoice = null;

  // Initialize Canvas
  const ctx = visualizerCanvas.getContext('2d');
  function resizeCanvas() {
    visualizerCanvas.width = visualizerCanvas.parentElement.clientWidth;
    visualizerCanvas.height = visualizerCanvas.parentElement.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Populate Voices for Speech Synthesis
  function populateVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    voices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
      if (voice.lang.includes('en') && !selectedVoice) {
        selectedVoice = voice;
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = populateVoices;
    populateVoices();
  }

  // Connect WebSocket
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/live`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      isConnected = true;
      connectionStatus.className = 'status-pill status-connected';
      statusLabel.textContent = 'Live Ready';
      micHint.textContent = 'Click to activate microphone';
    };

    ws.onclose = () => {
      isConnected = false;
      connectionStatus.className = 'status-pill status-disconnected';
      statusLabel.textContent = 'Disconnected';
      micStatusBadge.textContent = 'Reconnecting to agent...';
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
  }

  // Handle Incoming Server WebSocket Messages
  function handleServerMessage(msg) {
    switch (msg.type) {
      case 'session_ready':
        console.log('Session ready:', msg.sessionId);
        break;

      case 'speech_started':
        micStatusBadge.textContent = 'Listening to live voice...';
        connectionStatus.className = 'status-pill status-speaking';
        statusLabel.textContent = 'Speaking...';
        break;

      case 'speech_ended':
        micStatusBadge.textContent = 'Processing speech understanding...';
        break;

      case 'agent_thinking':
        showThinkingIndicator();
        micBtn.classList.remove('recording');
        micBtn.classList.add('processing');
        micStatusBadge.textContent = 'Agent is thinking & analyzing...';
        break;

      case 'transcription_final':
        appendMessage('user', msg.text);
        break;

      case 'tool_calling':
        appendToolBadge(msg.toolName, msg.parameters);
        break;

      case 'agent_response_complete':
        removeThinkingIndicator();
        micBtn.classList.remove('processing');
        if (isRecording) {
          micBtn.classList.add('recording');
          micStatusBadge.textContent = 'Listening to live voice...';
        } else {
          micStatusBadge.textContent = 'Ready for speech';
        }
        connectionStatus.className = 'status-pill status-connected';
        statusLabel.textContent = 'Live Ready';

        appendMessage('agent', msg.message.content, msg.intent);

        if (ttsEnabled && msg.message.content) {
          speakText(msg.message.content);
        }
        break;

      case 'error':
        removeThinkingIndicator();
        micBtn.classList.remove('processing');
        micStatusBadge.textContent = 'Error: ' + msg.message;
        appendMessage('agent', `⚠️ ${msg.message}`);
        break;
    }
  }

  // Speak Agent Reply using Web Speech API
  function speakText(text) {
    if (!('speechSynthesis' in window) || !ttsEnabled) return;

    window.speechSynthesis.cancel(); // Stop any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  // Start Audio Recording / Streaming
  async function startAudioStreaming() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      audioSource = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioSource.connect(analyser);

      // ScriptProcessor to capture PCM chunks (buffer size 4096 = ~256ms at 16kHz)
      scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      audioSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      scriptProcessor.onaudioprocess = (event) => {
        if (!isRecording || !ws || ws.readyState !== WebSocket.OPEN) return;

        const inputData = event.inputBuffer.getChannelData(0);
        const pcmBuffer = floatTo16BitPCM(inputData);
        const base64Audio = arrayBufferToBase64(pcmBuffer);

        ws.send(
          JSON.stringify({
            type: 'audio_chunk',
            data: base64Audio,
            mimeType: 'audio/pcm;rate=16000',
          })
        );
      };

      isRecording = true;
      micBtn.classList.add('recording');
      micStatusBadge.textContent = 'Microphone live — Speak now';
      micHint.textContent = 'Listening... (tap to pause)';
      drawVisualizer();
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please ensure microphone permissions are allowed.');
    }
  }

  function stopAudioStreaming() {
    isRecording = false;
    micBtn.classList.remove('recording', 'processing');
    micStatusBadge.textContent = 'Microphone paused';
    micHint.textContent = 'Click to resume live voice';

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop_speech' }));
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (scriptProcessor) {
      scriptProcessor.disconnect();
      scriptProcessor = null;
    }
    if (audioSource) {
      audioSource.disconnect();
      audioSource = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
  }

  // Toggle Live Microphone
  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      startAudioStreaming();
    } else {
      stopAudioStreaming();
    }
  });

  // Audio Conversion Helpers
  function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      let s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output.buffer;
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Canvas Real-Time Visualizer
  function drawVisualizer() {
    if (!isRecording) {
      ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
      return;
    }

    requestAnimationFrame(drawVisualizer);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const centerX = visualizerCanvas.width / 2;
    const centerY = visualizerCanvas.height / 2;
    const radius = 65;

    // Draw circular frequency bars
    const barCount = 48;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step] / 255.0;
      const barHeight = Math.max(4, value * 50);
      const angle = (i / barCount) * Math.PI * 2;

      const x1 = centerX + Math.cos(angle) * radius;
      const y1 = centerY + Math.sin(angle) * radius;
      const x2 = centerX + Math.cos(angle) * (radius + barHeight);
      const y2 = centerY + Math.sin(angle) * (radius + barHeight);

      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, '#6366f1');
      gradient.addColorStop(1, '#38bdf8');

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }

  // UI Message Append Functions
  function appendMessage(role, text, intent) {
    const welcome = document.querySelector('.welcome-card');
    if (welcome) welcome.remove();

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    meta.textContent = role === 'user' ? '🗣️ You' : `🤖 ${agentNameInput.value || 'Aria'}`;

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;

    bubble.appendChild(meta);
    bubble.appendChild(content);

    if (intent && intent.intent && intent.intent !== 'conversation') {
      const badge = document.createElement('div');
      badge.className = 'tool-badge';
      badge.textContent = `Intent: ${intent.intent}`;
      bubble.appendChild(badge);
    }

    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function appendToolBadge(toolName, params) {
    const badge = document.createElement('div');
    badge.className = 'tool-badge';
    badge.textContent = `⚡ Executing tool: ${toolName}(${JSON.stringify(params)})`;
    messagesContainer.appendChild(badge);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showThinkingIndicator() {
    if (currentThinkingElement) return;
    const ind = document.createElement('div');
    ind.className = 'thinking-indicator';
    ind.innerHTML = `<span></span><span></span><span></span>`;
    messagesContainer.appendChild(ind);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    currentThinkingElement = ind;
  }

  function removeThinkingIndicator() {
    if (currentThinkingElement) {
      currentThinkingElement.remove();
      currentThinkingElement = null;
    }
  }

  // Text Fallback Form Submission
  textInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = textInput.value.trim();
    if (!text) return;

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'text_input', text }));
      appendMessage('user', text);
      textInput.value = '';
    }
  });

  // Quick Prompt Chips
  promptChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-text');
      if (text && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'text_input', text }));
        appendMessage('user', text);
      }
    });
  });

  // Clear History
  clearHistoryBtn.addEventListener('click', () => {
    messagesContainer.innerHTML = `
      <div class="welcome-card">
        <div class="welcome-icon">🎙️</div>
        <h3>Ready for Live Speech</h3>
        <p>Speak naturally using your microphone. The Google ADK Agent understands speech in real-time, executes tools, and speaks answers back.</p>
      </div>
    `;
  });

  // TTS Toggle
  ttsToggleBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsToggleBtn.classList.toggle('active', ttsEnabled);
    ttsToggleBtn.querySelector('.btn-text').textContent = ttsEnabled ? 'Audio Out: On' : 'Audio Out: Off';
    if (!ttsEnabled && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  });

  // Settings Modal Handlers
  settingsToggleBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    if (voiceSelect.value && voices[voiceSelect.value]) {
      selectedVoice = voices[voiceSelect.value];
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'start_session',
          config: {
            agentName: agentNameInput.value,
            persona: agentPersonaInput.value,
            model: modelSelect.value,
          },
        })
      );
    }
    settingsModal.classList.add('hidden');
  });

  // Initial WebSocket Connection
  connectWebSocket();
});
