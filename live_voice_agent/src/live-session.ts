import { WebSocket } from 'ws';
import { VoiceProcessor } from './voice-processor.js';
import { googleAdkAgent } from './google-adk.js';
import { config } from './config.js';
import {
  ClientWebSocketMessage,
  ServerWebSocketMessage,
  SessionConfig,
  VoiceChatMessage,
} from './types.js';

export class LiveVoiceSession {
  public readonly id: string;
  private ws: WebSocket;
  private sessionConfig: SessionConfig;
  private audioChunks: Buffer[] = [];
  private isSpeaking: boolean = false;
  private silenceTimer: NodeJS.Timeout | null = null;
  private speechStartTime: number = 0;
  private isProcessing: boolean = false;
  private chatHistory: VoiceChatMessage[] = [];

  constructor(ws: WebSocket, customConfig?: Partial<SessionConfig>) {
    this.id = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.ws = ws;
    this.sessionConfig = {
      agentName: customConfig?.agentName || config.agentName,
      persona: customConfig?.persona || config.agentPersona,
      model: customConfig?.model || config.modelName,
      sampleRate: customConfig?.sampleRate || config.sampleRate,
      language: customConfig?.language || 'en-US',
      enableTools: customConfig?.enableTools ?? true,
      enableAudioOutput: customConfig?.enableAudioOutput ?? true,
    };

    this.initWebSocket();
  }

  private initWebSocket(): void {
    this.send({
      type: 'session_ready',
      sessionId: this.id,
      config: this.sessionConfig,
    });

    this.ws.on('message', async (raw: Buffer | string) => {
      try {
        if (Buffer.isBuffer(raw)) {
          // Binary audio chunk received directly
          await this.handleAudioBuffer(raw);
          return;
        }

        const msg: ClientWebSocketMessage = JSON.parse(raw.toString());
        await this.handleMessage(msg);
      } catch (err: any) {
        console.error(`[Session ${this.id}] Error handling incoming message:`, err);
        this.send({ type: 'error', message: err.message || 'Error processing message' });
      }
    });

    this.ws.on('close', () => {
      this.cleanup();
    });
  }

  public send(msg: ServerWebSocketMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private async handleMessage(msg: ClientWebSocketMessage): Promise<void> {
    switch (msg.type) {
      case 'start_session':
        if (msg.config) {
          Object.assign(this.sessionConfig, msg.config);
        }
        this.send({
          type: 'session_ready',
          sessionId: this.id,
          config: this.sessionConfig,
        });
        break;

      case 'audio_chunk':
        if (msg.data) {
          const buffer = Buffer.from(msg.data, 'base64');
          await this.handleAudioBuffer(buffer, msg.mimeType, msg.isLast);
        }
        break;

      case 'text_input':
        if (msg.text && msg.text.trim()) {
          await this.processTextInput(msg.text.trim());
        }
        break;

      case 'stop_speech':
        if (this.audioChunks.length > 0) {
          await this.finalizeSpeech();
        }
        break;

      case 'stop_session':
        this.cleanup();
        break;

      case 'ping':
        this.send({ type: 'pong' });
        break;
    }
  }

  public async handleAudioBuffer(buffer: Buffer, _mimeType?: string, isLast?: boolean): Promise<void> {
    const isSpeechSample = VoiceProcessor.isSpeech(buffer, config.vadThreshold);

    if (isSpeechSample) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        this.speechStartTime = Date.now();
        this.send({ type: 'speech_started', timestamp: this.speechStartTime });
      }

      // Reset silence timer
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }

      this.audioChunks.push(buffer);
    } else if (this.isSpeaking) {
      // Audio is silence while user was speaking -> accumulate short trailing buffer & schedule finalize
      this.audioChunks.push(buffer);

      if (!this.silenceTimer) {
        this.silenceTimer = setTimeout(() => {
          this.finalizeSpeech().catch((err) => {
            console.error(`[Session ${this.id}] Error finalizing speech:`, err);
          });
        }, config.silenceDurationMs);
      }
    }

    if (isLast && this.audioChunks.length > 0) {
      if (this.silenceTimer) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = null;
      }
      await this.finalizeSpeech();
    }
  }

  public async finalizeSpeech(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.isSpeaking = false;

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    const durationMs = this.speechStartTime > 0 ? Date.now() - this.speechStartTime : 0;
    this.send({ type: 'speech_ended', durationMs });

    const totalLength = this.audioChunks.reduce((acc, c) => acc + c.length, 0);
    if (totalLength < 1600) {
      // Audio buffer too short (< 50ms)
      this.audioChunks = [];
      this.isProcessing = false;
      return;
    }

    const pcmCombined = Buffer.concat(this.audioChunks);
    this.audioChunks = [];

    // Convert raw PCM to standard WAV format
    const wavBuffer = VoiceProcessor.pcmToWav(pcmCombined, this.sessionConfig.sampleRate);
    const wavBase64 = wavBuffer.toString('base64');

    this.send({ type: 'agent_thinking' });

    try {
      const result = await googleAdkAgent.processLiveAudio(
        wavBase64,
        'audio/wav',
        this.chatHistory,
        {
          onDelta: (delta, fullText) => {
            this.send({
              type: 'agent_response_chunk',
              delta,
              text: fullText,
            });
          },
          onToolCall: (toolName, parameters) => {
            this.send({
              type: 'tool_calling',
              toolName,
              parameters,
            });
          },
          onToolResult: (toolName, toolRes) => {
            this.send({
              type: 'tool_result',
              toolName,
              result: toolRes,
            });
          },
        }
      );

      // Record in conversation history
      if (result.transcript) {
        this.send({
          type: 'transcription_final',
          text: result.transcript,
          confidence: result.intent.confidence,
        });

        const userMsg: VoiceChatMessage = {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          content: result.transcript,
          timestamp: Date.now() - durationMs,
          audioDurationMs: durationMs,
        };

        const agentMsg: VoiceChatMessage = {
          id: `msg-${Date.now()}-agent`,
          role: 'agent',
          content: result.reply,
          timestamp: Date.now(),
          intent: result.intent.intent,
          toolExecution: result.toolExecution,
        };

        this.chatHistory.push(userMsg, agentMsg);

        this.send({
          type: 'agent_response_complete',
          message: agentMsg,
          intent: result.intent,
        });
      }
    } catch (err: any) {
      console.error(`[Session ${this.id}] Live speech processing error:`, err);
      this.send({
        type: 'error',
        message: err.message || 'Failed to understand live voice stream.',
      });
    } finally {
      this.isProcessing = false;
    }
  }

  public async processTextInput(text: string): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    this.send({ type: 'agent_thinking' });

    try {
      const result = await googleAdkAgent.respondToVoiceInput(
        text,
        this.chatHistory,
        {
          onDelta: (delta, fullText) => {
            this.send({
              type: 'agent_response_chunk',
              delta,
              text: fullText,
            });
          },
          onToolCall: (toolName, parameters) => {
            this.send({
              type: 'tool_calling',
              toolName,
              parameters,
            });
          },
          onToolResult: (toolName, toolRes) => {
            this.send({
              type: 'tool_result',
              toolName,
              result: toolRes,
            });
          },
        }
      );

      const userMsg: VoiceChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const agentMsg: VoiceChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: result.reply,
        timestamp: Date.now(),
        intent: result.intent.intent,
        toolExecution: result.toolExecution,
      };

      this.chatHistory.push(userMsg, agentMsg);

      this.send({
        type: 'agent_response_complete',
        message: agentMsg,
        intent: result.intent,
      });
    } catch (err: any) {
      console.error(`[Session ${this.id}] Text input processing error:`, err);
      this.send({
        type: 'error',
        message: err.message || 'Failed to process message.',
      });
    } finally {
      this.isProcessing = false;
    }
  }

  public getHistory(): VoiceChatMessage[] {
    return this.chatHistory;
  }

  public cleanup(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.audioChunks = [];
    this.isSpeaking = false;
    this.isProcessing = false;
  }
}
