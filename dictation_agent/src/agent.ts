import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config, validateConfig } from './config.js';

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface DictationOptions {
  mode?: 'polish' | 'bullet' | 'summary' | 'email' | 'raw';
  tone?: 'natural' | 'professional' | 'casual' | 'concise';
}

export class DictationAgent {
  private genAI: GoogleGenerativeAI | null = null;
  private modelName: string;

  constructor() {
    validateConfig();
    this.modelName = config.modelName;
    if (config.apiKey) {
      this.genAI = new GoogleGenerativeAI(config.apiKey);
    }
  }

  private getModel(systemInstruction?: string) {
    if (!this.genAI) {
      if (!config.apiKey) {
        throw new Error('API key is missing. Please set GEMINI_API_KEY or GOOGLE_API_KEY in .env file.');
      }
      this.genAI = new GoogleGenerativeAI(config.apiKey);
    }

    return this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction || undefined,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ],
    });
  }

  /**
   * Cleans, polishes, and structures dictated speech text.
   */
  async polishDictation(rawSpeech: string, options: DictationOptions = {}): Promise<string> {
    const mode = options.mode || 'polish';
    const tone = options.tone || 'natural';

    const systemInstruction = `You are an expert voice dictation assistant and transcription editor.
Your job is to take raw transcribed speech dictation from a user and refine it according to the requested mode while maintaining the user's authentic intent and meaning.
Guidelines:
- Remove verbal filler words (e.g., "um", "uh", "like", "you know", "er", "so yeah").
- Correct punctuation, capitalization, sentence boundaries, and homophone typos.
- Keep the output natural and ready to be read aloud or sent as text.
- Do not include conversational preambles like "Here is your text:" unless specifically asked. Output only the refined text.`;

    const prompt = `Dictation Mode: ${mode}
Desired Tone: ${tone}

Raw Spoken Input:
"""
${rawSpeech}
"""

Instructions based on mode:
- If mode is 'polish': Clean up fillers, fix grammar/punctuation, ensure smooth phrasing.
- If mode is 'bullet': Convert the main points and thoughts into neat bullet points.
- If mode is 'summary': Provide a concise, clear summary of what was dictated.
- If mode is 'email': Format the dictated thoughts as a well-written email draft.
- If mode is 'raw': Return the clean punctuated transcript without changing words.

Please provide the final formatted text:`;

    const model = this.getModel(systemInstruction);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  }

  /**
   * Conversation mode: User talks to the agent, agent responds intelligently.
   */
  async talkToAgent(userMessage: string, history: ChatMessage[] = []): Promise<string> {
    const systemInstruction = `You are a helpful, witty, and intelligent voice companion and dictation agent.
The user speaks to you via voice/dictation, and you respond clearly, concisely, and naturally.
Your responses are designed to be read back aloud using text-to-speech, so:
- Use clear punctuation and natural sentence pacing.
- Avoid unnecessary markdown clutter (like complex tables or excessive asterisks) that sounds bad when read aloud.
- Keep answers informative, direct, and pleasant to listen to.`;

    const model = this.getModel(systemInstruction);
    const chat = model.startChat({
      history: history.map((item) => ({
        role: item.role,
        parts: item.parts,
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    return response.text().trim();
  }

  /**
   * Transcribe and analyze uploaded audio file base64
   */
  async transcribeAudio(audioBase64: string, mimeType: string = 'audio/mp3'): Promise<string> {
    const model = this.getModel(
      'You are a high-accuracy speech-to-text audio transcription agent. Transcribe the audio accurately with proper punctuation and capitalization.'
    );

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: audioBase64,
        },
      },
      { text: 'Please accurately transcribe the speech in this audio recording.' },
    ]);

    const response = await result.response;
    return response.text().trim();
  }
}

export const agent = new DictationAgent();
