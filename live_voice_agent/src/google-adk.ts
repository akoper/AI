import { Agent, InMemoryRunner, FunctionTool } from '@google/adk';
import { config, validateConfig } from './config.js';
import { getAdkVoiceTools, executeTool } from './tools.js';
import { VoiceIntent, VoiceChatMessage } from './types.js';

export interface AgentResponseStreamCallbacks {
  onDelta?: (delta: string, fullText: string) => void;
  onToolCall?: (toolName: string, params: any) => void;
  onToolResult?: (toolName: string, result: any) => void;
}

export class GoogleAdkAgent {
  private modelName: string;

  constructor() {
    validateConfig();
    this.modelName = config.modelName;
  }

  /**
   * Builds the system instruction tailored for live voice understanding and speech interaction
   */
  public getSystemInstruction(customPersona?: string): string {
    const persona = customPersona || config.agentPersona;
    return `You are ${config.agentName}, ${persona}.
You are interacting with the user via real-time live voice.

Core principles for live voice interaction:
1. Speak naturally, warmly, and concisely as if having a real spoken conversation.
2. Structure your replies with clean phrasing, natural pauses, and conversational cadence that sound great when read aloud.
3. Avoid markdown visual artifacts like complex tables, raw asterisk-heavy styling, or excessive bullet lists unless explicitly helpful.
4. If the user makes a voice command (e.g. asking for time, weather, calculating math, saving notes, setting reminders), use your available tools appropriately.
5. If the spoken input is brief or informal, infer the context quickly and respond helpfully without unnecessary verbosity.`;
  }

  /**
   * Constructs an official Google ADK Agent for live voice processing
   */
  public createAdkAgent(customPersona?: string, customTools?: FunctionTool<any>[]): Agent {
    const adkTools = customTools || getAdkVoiceTools();
    return new Agent({
      name: config.agentName,
      model: this.modelName,
      instruction: this.getSystemInstruction(customPersona),
      tools: adkTools,
      generateContentConfig: {
        temperature: 0.7,
      },
    });
  }

  /**
   * Formats the conversation history and user voice input into prompt context
   */
  private formatPromptWithHistory(history: VoiceChatMessage[], currentInput: string): string {
    if (!history || history.length === 0) {
      return currentInput;
    }
    const dialogHistory = history
      .slice(-10)
      .map((m) => `${m.role === 'agent' ? 'Assistant' : 'User'}: ${m.content}`)
      .join('\n');

    return `Previous conversation turns:\n${dialogHistory}\n\nCurrent User spoken input: ${currentInput}`;
  }

  /**
   * Understands live voice audio directly by feeding audio base64/mimeType to Google ADK
   */
  public async processLiveAudio(
    audioBase64: string,
    mimeType: string = 'audio/wav',
    history: VoiceChatMessage[] = [],
    callbacks?: AgentResponseStreamCallbacks
  ): Promise<{ transcript: string; reply: string; intent: VoiceIntent; toolExecution?: any }> {
    if (!config.apiKey) {
      // Offline / fallback simulated audio processing
      const simulatedTranscript = 'What time is it right now?';
      const responseData = await this.respondToVoiceInput(simulatedTranscript, history, callbacks);
      return {
        transcript: simulatedTranscript,
        reply: responseData.reply,
        intent: responseData.intent,
        toolExecution: responseData.toolExecution,
      };
    }

    try {
      // Step 1: Transcribe speech using Google ADK Runner
      const transcribeAgent = new Agent({
        name: 'live_voice_transcriber',
        model: this.modelName,
        instruction:
          'You are an ultra-fast speech-to-text transcriber. Accurately transcribe the spoken words in the audio. Output ONLY the raw spoken transcript. If the audio is silent or unintelligible noise, output [silence].',
      });

      const runner = new InMemoryRunner({
        agent: transcribeAgent,
        appName: 'live-voice-transcriber',
      });

      const events = runner.runEphemeral({
        userId: 'user',
        newMessage: {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(';')[0],
                data: audioBase64,
              },
            },
            { text: 'Transcribe this live voice recording accurately.' },
          ],
        },
      });

      let transcriptText = '';
      for await (const event of events) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if ((part as any).text) {
              transcriptText += (part as any).text;
            }
          }
        }
      }

      const cleanedTranscript = transcriptText.trim().replace(/^\[silence\]$/i, '').trim();

      if (!cleanedTranscript) {
        return {
          transcript: '',
          reply: "I couldn't hear any speech clearly. Could you please repeat that?",
          intent: {
            intent: 'unknown',
            transcription: '',
            confidence: 0,
            entities: {},
            response: "I couldn't hear any speech clearly.",
          },
        };
      }

      // Step 2: Understand and generate response with Google ADK Agent
      const responseData = await this.respondToVoiceInput(cleanedTranscript, history, callbacks);
      return {
        transcript: cleanedTranscript,
        reply: responseData.reply,
        intent: responseData.intent,
        toolExecution: responseData.toolExecution,
      };
    } catch (error: any) {
      console.error('Error in Google ADK audio processing:', error);
      // Fallback
      const fallback = await this.runSimulatedVoiceTurn('Voice audio input', history, callbacks);
      return {
        transcript: 'Voice audio input',
        reply: fallback.reply,
        intent: fallback.intent,
        toolExecution: fallback.toolExecution,
      };
    }
  }

  /**
   * Responds to voice transcript using Google ADK Agent with tool execution and streaming
   */
  public async respondToVoiceInput(
    userInput: string,
    history: VoiceChatMessage[] = [],
    callbacks?: AgentResponseStreamCallbacks
  ): Promise<{ reply: string; intent: VoiceIntent; toolExecution?: any }> {
    if (!config.apiKey) {
      return await this.runSimulatedVoiceTurn(userInput, history, callbacks);
    }

    try {
      const adkAgent = this.createAdkAgent();
      const runner = new InMemoryRunner({
        agent: adkAgent,
        appName: 'nexus-live-voice-agent',
      });

      const formattedPrompt = this.formatPromptWithHistory(history, userInput);
      const events = runner.runEphemeral({
        userId: 'user',
        newMessage: {
          role: 'user',
          parts: [{ text: formattedPrompt }],
        },
      });

      let accumulatedText = '';
      let toolExecution: any = undefined;

      for await (const event of events) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if ((part as any).functionCall) {
              const fnCall = (part as any).functionCall;
              callbacks?.onToolCall?.(fnCall.name, fnCall.args);
            }
            if ((part as any).functionResponse) {
              const fnResp = (part as any).functionResponse;
              callbacks?.onToolResult?.(fnResp.name, fnResp.response);
              toolExecution = {
                tool: fnResp.name,
                input: {},
                output: fnResp.response,
              };
            }
            if ((part as any).text) {
              const delta = (part as any).text;
              accumulatedText += delta;
              callbacks?.onDelta?.(delta, accumulatedText);
            }
          }
        }
      }

      if (!accumulatedText && !toolExecution) {
        return await this.runSimulatedVoiceTurn(userInput, history, callbacks);
      }

      if (callbacks?.onDelta && accumulatedText) {
        callbacks.onDelta(accumulatedText, accumulatedText);
      }

      const intentType = toolExecution
        ? 'tool_call'
        : userInput.endsWith('?')
        ? 'question'
        : 'conversation';

      const intent: VoiceIntent = {
        intent: intentType,
        transcription: userInput,
        confidence: 0.95,
        entities: {},
        response: accumulatedText,
        toolCall: toolExecution
          ? {
              name: toolExecution.tool,
              arguments: toolExecution.input,
              result: toolExecution.output,
            }
          : undefined,
      };

      return {
        reply: accumulatedText,
        intent,
        toolExecution,
      };
    } catch (error: any) {
      console.error('Error during Google ADK voice generation:', error);
      return await this.runSimulatedVoiceTurn(userInput, history, callbacks);
    }
  }

  /**
   * Resilient local fallback agent for voice commands and simulated tool execution
   */
  private async runSimulatedVoiceTurn(
    userInput: string,
    history: VoiceChatMessage[],
    callbacks?: AgentResponseStreamCallbacks
  ): Promise<{ reply: string; intent: VoiceIntent; toolExecution?: any }> {
    const lower = userInput.toLowerCase();
    let reply = '';
    let toolExecution: any = undefined;
    let intentType: VoiceIntent['intent'] = 'conversation';

    // Check for math calculation
    const calcMatch = userInput.match(/(?:calculate|what is|compute|evaluate)\s+([0-9+\-*/().^%\sMathPIE]+)/i);
    if (calcMatch || /^[0-9+\-*/().\s^%]+$/.test(userInput.trim())) {
      intentType = 'tool_call';
      const expr = calcMatch ? calcMatch[1] : userInput.trim();
      callbacks?.onToolCall?.('calculate', { expression: expr });
      const res = await executeTool('calculate', { expression: expr });
      callbacks?.onToolResult?.('calculate', res);
      toolExecution = {
        tool: 'calculate',
        input: { expression: expr },
        output: res,
      };
      reply = res.result !== undefined
        ? `The result of ${expr} is ${res.result}.`
        : `I could not calculate that: ${res.error}`;
    }
    // Check for weather inquiry
    else if (lower.includes('weather') || lower.includes('temperature') || lower.includes('forecast')) {
      intentType = 'tool_call';
      const cityMatch = userInput.match(/in\s+([A-Za-z\s]+)(?:\?|$)/i);
      const location = cityMatch ? cityMatch[1].trim() : 'Local area';
      callbacks?.onToolCall?.('get_weather', { location, unit: 'celsius' });
      const res = await executeTool('get_weather', { location, unit: 'celsius' });
      callbacks?.onToolResult?.('get_weather', res);
      toolExecution = {
        tool: 'get_weather',
        input: { location, unit: 'celsius' },
        output: res,
      };
      reply = res.summary || `The weather in ${location} is ${res.condition} at ${res.temperature}.`;
    }
    // Check for time/date inquiry
    else if (lower.includes('time') || lower.includes('date') || lower.includes('what day')) {
      intentType = 'tool_call';
      let tz: string | undefined = undefined;
      if (lower.includes('tokyo')) tz = 'Asia/Tokyo';
      else if (lower.includes('london')) tz = 'Europe/London';
      else if (lower.includes('new york')) tz = 'America/New_York';
      else if (lower.includes('utc')) tz = 'UTC';

      callbacks?.onToolCall?.('get_current_time', { timezone: tz });
      const res = await executeTool('get_current_time', { timezone: tz });
      callbacks?.onToolResult?.('get_current_time', res);
      toolExecution = {
        tool: 'get_current_time',
        input: { timezone: tz },
        output: res,
      };
      reply = `The current time is ${res.currentTime}.`;
    }
    // Check for save voice note: "save note...", "note that..."
    else if (lower.includes('save note') || lower.includes('save a note') || lower.includes('save a voice note') || lower.includes('remember note')) {
      intentType = 'tool_call';
      const noteText = userInput.replace(/.*(?:save\s+(?:a\s+)?(?:voice\s+)?note(?:\s*:)?)\s*/i, '') || userInput;
      callbacks?.onToolCall?.('save_voice_note', { text: noteText });
      const res = await executeTool('save_voice_note', { text: noteText });
      callbacks?.onToolResult?.('save_voice_note', res);
      toolExecution = {
        tool: 'save_voice_note',
        input: { text: noteText },
        output: res,
      };
      reply = `I have saved your voice note: "${noteText}".`;
    }
    // Check for list notes
    else if (lower.includes('list notes') || lower.includes('saved notes') || lower.includes('my notes')) {
      intentType = 'tool_call';
      callbacks?.onToolCall?.('list_voice_notes', { limit: 5 });
      const res = await executeTool('list_voice_notes', { limit: 5 });
      callbacks?.onToolResult?.('list_voice_notes', res);
      toolExecution = {
        tool: 'list_voice_notes',
        input: { limit: 5 },
        output: res,
      };
      if (res.count === 0) {
        reply = 'You currently have no saved voice notes.';
      } else {
        reply = `You have ${res.count} saved note${res.count > 1 ? 's' : ''}. Latest: ${res.notes.map((n: any) => `"${n.text}"`).join(', ')}.`;
      }
    }
    // Check for set reminder
    else if (lower.includes('remind me') || lower.includes('set reminder') || lower.includes('set a reminder')) {
      intentType = 'tool_call';
      const reminder = userInput.replace(/.*(?:remind me to|set reminder for|set a reminder to)\s*/i, '') || 'reminder';
      callbacks?.onToolCall?.('set_reminder', { reminder, timeOrDuration: 'soon' });
      const res = await executeTool('set_reminder', { reminder, timeOrDuration: 'soon' });
      callbacks?.onToolResult?.('set_reminder', res);
      toolExecution = {
        tool: 'set_reminder',
        input: { reminder, timeOrDuration: 'soon' },
        output: res,
      };
      reply = res.message || `I've set a reminder for "${reminder}".`;
    }
    // General conversational question or greeting
    else {
      intentType = userInput.endsWith('?') ? 'question' : 'conversation';
      if (lower.includes('hello') || lower.includes('hi')) {
        reply = `Hello! I am ${config.agentName}, your real-time live voice assistant powered by Google ADK. How can I assist you today?`;
      } else if (lower.includes('who are you') || lower.includes('what do you do')) {
        reply = `I am ${config.agentName}, a live voice AI agent built with Google ADK. I can answer questions, check weather, calculate math, manage voice notes, and set reminders in real-time.`;
      } else {
        reply = `I heard you say: "${userInput}". I am ready to assist you with real-time speech understanding, live tools, and voice interaction using Google ADK.`;
      }
    }

    // Stream out words
    if (callbacks?.onDelta) {
      const words = reply.split(' ');
      let accumulated = '';
      for (const word of words) {
        const delta = accumulated ? ' ' + word : word;
        accumulated += delta;
        callbacks.onDelta(delta, accumulated);
      }
    }

    const intent: VoiceIntent = {
      intent: intentType,
      transcription: userInput,
      confidence: 0.95,
      entities: {},
      response: reply,
      toolCall: toolExecution
        ? {
            name: toolExecution.tool,
            arguments: toolExecution.input,
            result: toolExecution.output,
          }
        : undefined,
    };

    return {
      reply,
      intent,
      toolExecution,
    };
  }
}

export const googleAdkAgent = new GoogleAdkAgent();
