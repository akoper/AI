import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config, validateConfig } from './config.js';
import { getToolDeclarations, executeTool } from './tools.js';
import { VoiceIntent, VoiceChatMessage } from './types.js';

export interface AgentResponseStreamCallbacks {
  onDelta?: (delta: string, fullText: string) => void;
  onToolCall?: (toolName: string, params: any) => void;
  onToolResult?: (toolName: string, result: any) => void;
}

export class GoogleAdkAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor() {
    validateConfig();
    this.modelName = config.modelName;
    if (config.apiKey) {
      this.genAI = new GoogleGenerativeAI(config.apiKey);
    }
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      if (!config.apiKey) {
        throw new Error('Gemini API key is missing. Set GEMINI_API_KEY in .env');
      }
      this.genAI = new GoogleGenerativeAI(config.apiKey);
    }
    return this.genAI;
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
3. Avoid markdown visual artifacts like complex markdown tables, raw asterisk-heavy styling, or excessive bullet lists unless explicitly helpful.
4. If the user makes a voice command (e.g. asking for time, weather, calculating math, saving notes, setting reminders), use your available tools appropriately.
5. If the spoken input is brief or informal, infer the context quickly and respond helpfully without unnecessary verbosity.`;
  }

  /**
   * Understands live voice audio directly by feeding audio base64/mimeType to Gemini Multimodal
   */
  public async processLiveAudio(
    audioBase64: string,
    mimeType: string = 'audio/wav',
    history: VoiceChatMessage[] = [],
    callbacks?: AgentResponseStreamCallbacks
  ): Promise<{ transcript: string; reply: string; intent: VoiceIntent; toolExecution?: any }> {
    const ai = this.getClient();
    const systemInstruction = this.getSystemInstruction();

    const model = ai.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // Step 1: Transcribe and understand the live speech
    const transcribeModel = ai.getGenerativeModel({
      model: this.modelName,
      systemInstruction: 'You are an ultra-fast speech-to-text transcriber. Accurately transcribe the spoken words in the audio. Output ONLY the raw spoken transcript. If the audio is silent or unintelligible noise, output [silence].',
    });

    const transcriptionResult = await transcribeModel.generateContent([
      {
        inlineData: {
          mimeType: mimeType.split(';')[0],
          data: audioBase64,
        },
      },
      { text: 'Transcribe this live voice recording accurately.' },
    ]);

    const transcriptText = (await transcriptionResult.response).text().trim();
    const cleanedTranscript = transcriptText.replace(/^\[silence\]$/i, '').trim();

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

    // Step 2: Understand and generate response with tools and conversational context
    const responseData = await this.respondToVoiceInput(cleanedTranscript, history, callbacks);
    return {
      transcript: cleanedTranscript,
      reply: responseData.reply,
      intent: responseData.intent,
      toolExecution: responseData.toolExecution,
    };
  }

  /**
   * Responds to voice transcript with intent recognition, tool invocation, and streaming response
   */
  public async respondToVoiceInput(
    userInput: string,
    history: VoiceChatMessage[] = [],
    callbacks?: AgentResponseStreamCallbacks
  ): Promise<{ reply: string; intent: VoiceIntent; toolExecution?: any }> {
    const ai = this.getClient();
    const systemInstruction = this.getSystemInstruction();

    // Check if tools can be invoked
    const toolDeclarations = getToolDeclarations();
    const model = ai.getGenerativeModel({
      model: this.modelName,
      systemInstruction,
      tools: [{ functionDeclarations: toolDeclarations as any }],
    });

    const chatHistory = history
      .filter((h) => h.content && h.content.trim())
      .map((msg) => ({
        role: msg.role === 'agent' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    const chat = model.startChat({
      history: chatHistory,
    });

    let toolExecution: any = undefined;
    let fullResponseText = '';

    // Send the user voice message to Gemini
    const result = await chat.sendMessage(userInput);
    const response = await result.response;
    
    // Check if Gemini requested function call(s)
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const toolName = call.name;
      const toolArgs = call.args || {};

      callbacks?.onToolCall?.(toolName, toolArgs);

      let toolResult: any;
      try {
        toolResult = await executeTool(toolName, toolArgs as Record<string, any>);
      } catch (err: any) {
        toolResult = { error: err.message };
      }

      callbacks?.onToolResult?.(toolName, toolResult);

      toolExecution = {
        tool: toolName,
        input: toolArgs,
        output: toolResult,
      };

      // Provide function response back to Gemini to synthesize natural spoken answer
      const followup = await chat.sendMessage([
        {
          functionResponse: {
            name: toolName,
            response: toolResult,
          },
        },
      ]);
      const followupResponse = await followup.response;
      fullResponseText = followupResponse.text().trim();
    } else {
      fullResponseText = response.text().trim();
    }

    // Stream out the final response in chunks for fast delivery
    if (callbacks?.onDelta) {
      const words = fullResponseText.split(' ');
      let accumulated = '';
      for (const word of words) {
        const delta = accumulated ? ' ' + word : word;
        accumulated += delta;
        callbacks.onDelta(delta, accumulated);
      }
    }

    const intentType = toolExecution ? 'tool_call' : (userInput.endsWith('?') ? 'question' : 'conversation');
    const intent: VoiceIntent = {
      intent: intentType,
      transcription: userInput,
      confidence: 0.95,
      entities: {},
      response: fullResponseText,
      toolCall: toolExecution ? {
        name: toolExecution.tool,
        arguments: toolExecution.input,
        result: toolExecution.output,
      } : undefined,
    };

    return {
      reply: fullResponseText,
      intent,
      toolExecution,
    };
  }
}

export const googleAdkAgent = new GoogleAdkAgent();
