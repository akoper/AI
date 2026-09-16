export interface AudioChunk {
  data: string; // Base64 encoded audio
  mimeType: string; // e.g., 'audio/pcm;rate=16000', 'audio/wav', 'audio/webm'
  timestamp: number;
  sampleRate?: number;
}

export interface VoiceIntent {
  intent: 'question' | 'command' | 'tool_call' | 'conversation' | 'dictation' | 'unknown';
  transcription: string;
  confidence: number;
  entities: Record<string, any>;
  response: string;
  toolCall?: {
    name: string;
    arguments: Record<string, any>;
    result?: any;
  };
}

export interface VoiceChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: number;
  audioDurationMs?: number;
  intent?: string;
  toolExecution?: {
    tool: string;
    input: any;
    output: any;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  handler: (args: any) => Promise<any> | any;
}

export type ClientWebSocketMessage =
  | { type: 'start_session'; config?: Partial<SessionConfig> }
  | { type: 'audio_chunk'; data: string; mimeType?: string; isLast?: boolean }
  | { type: 'text_input'; text: string }
  | { type: 'stop_speech' }
  | { type: 'stop_session' }
  | { type: 'ping' };

export type ServerWebSocketMessage =
  | { type: 'session_ready'; sessionId: string; config: SessionConfig }
  | { type: 'speech_started'; timestamp: number }
  | { type: 'speech_ended'; durationMs: number }
  | { type: 'transcription_interim'; text: string }
  | { type: 'transcription_final'; text: string; confidence?: number }
  | { type: 'agent_thinking' }
  | { type: 'agent_response_chunk'; text: string; delta: string }
  | { type: 'agent_response_complete'; message: VoiceChatMessage; intent?: VoiceIntent }
  | { type: 'tool_calling'; toolName: string; parameters: any }
  | { type: 'tool_result'; toolName: string; result: any }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };

export interface SessionConfig {
  agentName: string;
  persona: string;
  model: string;
  sampleRate: number;
  language: string;
  enableTools: boolean;
  enableAudioOutput: boolean;
}
