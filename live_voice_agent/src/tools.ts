import { ToolDefinition } from './types.js';

interface VoiceNote {
  id: string;
  text: string;
  createdAt: string;
  tags?: string[];
}

const voiceNotes: VoiceNote[] = [];

export const tools: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: 'Get the current local date, time, and timezone information.',
    parameters: {
      type: 'OBJECT',
      properties: {
        timezone: {
          type: 'STRING',
          description: 'Optional IANA timezone name (e.g., "America/New_York", "Europe/London", "UTC"). Defaults to local system time.',
        },
      },
    },
    handler: async (args: { timezone?: string }) => {
      const now = new Date();
      try {
        const timeStr = args.timezone
          ? now.toLocaleString('en-US', { timeZone: args.timezone, dateStyle: 'full', timeStyle: 'long' })
          : now.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' });
        return {
          currentTime: timeStr,
          timestamp: now.toISOString(),
          timezone: args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      } catch (err: any) {
        return {
          currentTime: now.toLocaleString(),
          timestamp: now.toISOString(),
          note: `Used local time because timezone '${args.timezone}' was not recognized.`,
        };
      }
    },
  },
  {
    name: 'get_weather',
    description: 'Get current weather conditions and forecast for a given location or city.',
    parameters: {
      type: 'OBJECT',
      properties: {
        location: {
          type: 'STRING',
          description: 'City or location name (e.g., "San Francisco", "Tokyo", "London").',
        },
        unit: {
          type: 'STRING',
          description: 'Temperature unit: "celsius" or "fahrenheit". Default is celsius.',
          enum: ['celsius', 'fahrenheit'],
        },
      },
      required: ['location'],
    },
    handler: async (args: { location: string; unit?: string }) => {
      const location = args.location || 'Local area';
      const unit = args.unit || 'celsius';
      
      // Realistic mock weather generator for responsive voice interaction
      const conditions = ['Clear and sunny', 'Partly cloudy', 'Overcast', 'Light rain', 'Breezy and pleasant'];
      const hash = location.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const condition = conditions[hash % conditions.length];
      const tempC = 16 + (hash % 14);
      const tempF = Math.round((tempC * 9) / 5 + 32);
      const temp = unit === 'fahrenheit' ? `${tempF}°F` : `${tempC}°C`;
      const humidity = 40 + (hash % 45);
      const windSpeed = 5 + (hash % 15);

      return {
        location,
        condition,
        temperature: temp,
        humidity: `${humidity}%`,
        wind: `${windSpeed} km/h`,
        summary: `The weather in ${location} is currently ${condition.toLowerCase()} with a temperature of ${temp} and humidity of ${humidity}%.`,
      };
    },
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations, arithmetic, or unit conversions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        expression: {
          type: 'STRING',
          description: 'The math expression to evaluate (e.g., "25 * 4 + 10", "sqrt(144)", "15% of 85").',
        },
      },
      required: ['expression'],
    },
    handler: async (args: { expression: string }) => {
      const expr = args.expression;
      try {
        // Safe evaluation of sanitized math expression
        const sanitized = expr
          .replace(/[^0-9+\-*/().,%^sqrtpieE ]/g, '')
          .replace(/%/g, '/100')
          .replace(/\^/g, '**')
          .replace(/sqrt\(/g, 'Math.sqrt(')
          .replace(/pi/gi, 'Math.PI')
          .replace(/e/gi, 'Math.E');

        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${sanitized});`)();
        return {
          expression: expr,
          result: typeof result === 'number' ? Math.round(result * 100000) / 100000 : result,
        };
      } catch (err: any) {
        return {
          expression: expr,
          error: 'Could not evaluate mathematical expression safely.',
        };
      }
    },
  },
  {
    name: 'save_voice_note',
    description: 'Save a dictated voice note, thought, or memo into memory.',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: {
          type: 'STRING',
          description: 'The content of the voice note to record.',
        },
        tags: {
          type: 'STRING',
          description: 'Optional comma-separated tags (e.g., "work, idea, urgent").',
        },
      },
      required: ['text'],
    },
    handler: async (args: { text: string; tags?: string }) => {
      const note: VoiceNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: args.text,
        createdAt: new Date().toISOString(),
        tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : undefined,
      };
      voiceNotes.push(note);
      return {
        success: true,
        message: `Voice note saved: "${args.text.length > 50 ? args.text.substring(0, 50) + '...' : args.text}"`,
        noteId: note.id,
        totalNotes: voiceNotes.length,
      };
    },
  },
  {
    name: 'list_voice_notes',
    description: 'Retrieve or list all previously saved voice notes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: {
          type: 'NUMBER',
          description: 'Maximum number of notes to retrieve. Defaults to 5.',
        },
      },
    },
    handler: async (args: { limit?: number }) => {
      const limit = args.limit || 5;
      const recent = voiceNotes.slice(-limit).reverse();
      return {
        count: voiceNotes.length,
        notes: recent,
        summary: recent.length === 0
          ? 'No voice notes saved yet.'
          : `Found ${recent.length} recent notes.`,
      };
    },
  },
  {
    name: 'set_reminder',
    description: 'Set a voice reminder or timer for the user.',
    parameters: {
      type: 'OBJECT',
      properties: {
        reminder: {
          type: 'STRING',
          description: 'What the user needs to be reminded of.',
        },
        timeOrDuration: {
          type: 'STRING',
          description: 'When to remind (e.g., "in 10 minutes", "at 3:00 PM", "tomorrow morning").',
        },
      },
      required: ['reminder', 'timeOrDuration'],
    },
    handler: async (args: { reminder: string; timeOrDuration: string }) => {
      return {
        success: true,
        reminder: args.reminder,
        scheduledFor: args.timeOrDuration,
        message: `Reminder set for "${args.reminder}" ${args.timeOrDuration}.`,
      };
    },
  },
];

export function getToolDeclarations() {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: tool.parameters.type,
      properties: tool.parameters.properties,
      required: tool.parameters.required || [],
    },
  }));
}

export async function executeTool(name: string, args: Record<string, any>) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Tool '${name}' not found.`);
  }
  return await tool.handler(args);
}

export function getAllVoiceNotes() {
  return voiceNotes;
}
