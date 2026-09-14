// Voice Dictation & Agent Client Logic

// State
let isRecording = false;
let recognition = null;
let currentUtterance = null;
let chatHistory = [];
let availableVoices = [];

// DOM Elements
const micBtn = document.getElementById('micBtn');
const micStatus = document.getElementById('micStatus');
const audioWave = document.getElementById('audioWave');
const dictationInput = document.getElementById('dictationInput');
const clearTextBtn = document.getElementById('clearTextBtn');
const copyTextBtn = document.getElementById('copyTextBtn');

const talkAgentBtn = document.getElementById('talkAgentBtn');
const readDictationBtn = document.getElementById('readDictationBtn');
const polishBtn = document.getElementById('polishBtn');
const bulletBtn = document.getElementById('bulletBtn');
const summaryBtn = document.getElementById('summaryBtn');
const emailBtn = document.getElementById('emailBtn');

const voiceSelect = document.getElementById('voiceSelect');
const rateSlider = document.getElementById('rateSlider');
const pitchSlider = document.getElementById('pitchSlider');
const rateVal = document.getElementById('rateVal');
const pitchVal = document.getElementById('pitchVal');
const stopAudioBtn = document.getElementById('stopAudioBtn');
const autoReadToggle = document.getElementById('autoReadToggle');

const chatStream = document.getElementById('chatStream');
const clearChatBtn = document.getElementById('clearChatBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const loadingText = document.getElementById('loadingText');

const apiStatusBadge = document.getElementById('apiStatusBadge');
const apiStatusText = document.getElementById('apiStatusText');
const speechSupportBadge = document.getElementById('speechSupportBadge');

// 1. Initialize Speech Recognition (Web Speech API)
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    speechSupportBadge.textContent = 'Speech API Not Supported (Type instead)';
    speechSupportBadge.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
    speechSupportBadge.style.color = '#ef4444';
    micStatus.textContent = 'Voice recognition not supported in this browser. Please use Chrome/Edge or type manually.';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    audioWave.classList.remove('hidden');
    micStatus.textContent = 'Listening... Speak clearly into your microphone.';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const currentBase = dictationInput.dataset.baseText || '';
    const separator = currentBase && (finalTranscript || interimTranscript) ? ' ' : '';
    dictationInput.value = currentBase + separator + finalTranscript + (interimTranscript ? ` (${interimTranscript})` : '');
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      micStatus.textContent = 'Microphone access denied. Please allow microphone permissions.';
    } else {
      micStatus.textContent = `Mic error: ${event.error}`;
    }
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) {
      // Auto-restart if user didn't explicitly click stop
      try {
        recognition.start();
      } catch (e) {
        stopRecording();
      }
    } else {
      stopRecording();
    }
  };
}

function startRecording() {
  if (!recognition) {
    alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
    return;
  }
  // Remember existing manually typed text as base
  dictationInput.dataset.baseText = dictationInput.value.replace(/\s*\([^\)]*\)$/, '').trim();
  try {
    recognition.start();
  } catch (err) {
    console.warn('Recognition start exception:', err);
  }
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove('recording');
  audioWave.classList.add('hidden');
  micStatus.textContent = 'Click microphone to start dictating';
  // Clean up any trailing interim parenthesis
  dictationInput.value = dictationInput.value.replace(/\s*\([^\)]*\)$/, '').trim();
  delete dictationInput.dataset.baseText;

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }
}

micBtn.addEventListener('click', () => {
  if (isRecording) {
    stopRecording();
  } else {
    // If speaking, cancel reading
    stopSpeech();
    startRecording();
  }
});

// 2. Text-to-Speech (Read Aloud) Engine
function initSpeechSynthesis() {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported.');
    return;
  }

  function populateVoiceList() {
    availableVoices = window.speechSynthesis.getVoices();
    voiceSelect.innerHTML = '';

    const englishVoices = availableVoices.filter((v) => v.lang.startsWith('en'));
    const voicesToShow = englishVoices.length > 0 ? englishVoices : availableVoices;

    voicesToShow.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})${voice.default ? ' — Default' : ''}`;
      if (voice.name.includes('Google') || voice.name.includes('Natural') || voice.default) {
        option.selected = true;
      }
      voiceSelect.appendChild(option);
    });

    if (voiceSelect.options.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Default System Voice';
      voiceSelect.appendChild(opt);
    }
  }

  populateVoiceList();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    alert('Speech synthesis is not supported in your browser.');
    return;
  }

  if (!text || !text.trim()) {
    alert('No text available to read.');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Strip markdown symbols for smoother speech reading
  const cleanText = text
    .replace(/[#*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .trim();

  currentUtterance = new SpeechSynthesisUtterance(cleanText);
  currentUtterance.rate = parseFloat(rateSlider.value);
  currentUtterance.pitch = parseFloat(pitchSlider.value);

  const selectedVoiceName = voiceSelect.value;
  if (selectedVoiceName && availableVoices.length > 0) {
    const voice = availableVoices.find((v) => v.name === selectedVoiceName);
    if (voice) currentUtterance.voice = voice;
  }

  currentUtterance.onstart = () => {
    stopAudioBtn.disabled = false;
    readDictationBtn.classList.add('reading-active');
  };

  currentUtterance.onend = () => {
    stopAudioBtn.disabled = true;
    readDictationBtn.classList.remove('reading-active');
  };

  currentUtterance.onerror = (e) => {
    console.error('Speech synthesis error:', e);
    stopAudioBtn.disabled = true;
    readDictationBtn.classList.remove('reading-active');
  };

  window.speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    stopAudioBtn.disabled = true;
    readDictationBtn.classList.remove('reading-active');
  }
}

stopAudioBtn.addEventListener('click', stopSpeech);

// Read dictated text button
readDictationBtn.addEventListener('click', () => {
  const text = dictationInput.value.trim();
  if (!text) {
    alert('Please dictate or type something first to read it back.');
    return;
  }
  speakText(text);
});

// Slider updates
rateSlider.addEventListener('input', () => {
  rateVal.textContent = `${rateSlider.value}x`;
});
pitchSlider.addEventListener('input', () => {
  pitchVal.textContent = pitchSlider.value;
});

// 3. UI Helpers
function appendMessage(role, title, text) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role === 'user' ? 'user-message' : 'agent-message'}`;

  const metaEl = document.createElement('div');
  metaEl.className = 'message-meta';
  metaEl.innerHTML = `<span>${title}</span>`;

  const actionsEl = document.createElement('div');
  actionsEl.className = 'message-actions';

  const readBtn = document.createElement('button');
  readBtn.className = 'btn-msg-read';
  readBtn.textContent = '🔊 Read';
  readBtn.title = 'Read this message aloud';
  readBtn.onclick = () => speakText(text);

  actionsEl.appendChild(readBtn);
  metaEl.appendChild(actionsEl);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'message-body';
  bodyEl.textContent = text;

  msgEl.appendChild(metaEl);
  msgEl.appendChild(bodyEl);
  chatStream.appendChild(msgEl);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function setLoading(isLoading, text = 'Agent is processing...') {
  if (isLoading) {
    loadingText.textContent = text;
    loadingIndicator.classList.remove('hidden');
  } else {
    loadingIndicator.classList.add('hidden');
  }
}

// 4. API Calls
async function handleDictationTransform(mode) {
  const text = dictationInput.value.trim();
  if (!text) {
    alert('Please speak or type some text first.');
    return;
  }

  setLoading(true, `Refining dictation (${mode})...`);
  try {
    const res = await fetch('/api/dictate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to refine dictation');

    appendMessage('user', '🗣️ Dictation Input', text);
    appendMessage('agent', `✨ Refined (${mode.toUpperCase()})`, data.result);

    // Update input with refined text for convenience
    dictationInput.value = data.result;

    if (autoReadToggle.checked) {
      speakText(data.result);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

async function handleTalkToAgent() {
  const text = dictationInput.value.trim();
  if (!text) {
    alert('Please dictate or type a message to talk to the agent.');
    return;
  }

  appendMessage('user', '🗣️ You (Dictated)', text);
  chatHistory.push({ role: 'user', parts: [{ text }] });
  dictationInput.value = '';

  setLoading(true, 'Google AI Agent is replying...');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: chatHistory }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Agent request failed');

    appendMessage('agent', '🤖 Gemini Agent', data.reply);
    chatHistory.push({ role: 'model', parts: [{ text: data.reply }] });

    // Auto-read response if enabled
    if (autoReadToggle.checked) {
      speakText(data.reply);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    setLoading(false);
  }
}

// Event Listeners for Agent Actions
talkAgentBtn.addEventListener('click', handleTalkToAgent);
polishBtn.addEventListener('click', () => handleDictationTransform('polish'));
bulletBtn.addEventListener('click', () => handleDictationTransform('bullet'));
summaryBtn.addEventListener('click', () => handleDictationTransform('summary'));
emailBtn.addEventListener('click', () => handleDictationTransform('email'));

clearTextBtn.addEventListener('click', () => {
  dictationInput.value = '';
});

copyTextBtn.addEventListener('click', () => {
  if (!dictationInput.value) return;
  navigator.clipboard.writeText(dictationInput.value);
  copyTextBtn.textContent = 'Copied!';
  setTimeout(() => (copyTextBtn.textContent = 'Copy'), 1500);
});

clearChatBtn.addEventListener('click', () => {
  chatStream.innerHTML = '';
  chatHistory = [];
});

// Check API Status on load
async function checkApiStatus() {
  const dot = apiStatusBadge.querySelector('.status-dot');
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.hasApiKey) {
      dot.className = 'status-dot active';
      apiStatusText.textContent = `Online • ${data.model} (.env OK)`;
    } else {
      dot.className = 'status-dot error';
      apiStatusText.textContent = 'API Key Missing in .env';
    }
  } catch (err) {
    dot.className = 'status-dot error';
    apiStatusText.textContent = 'Backend Offline';
  }
}

// Initialization
window.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  initSpeechSynthesis();
  checkApiStatus();
});
