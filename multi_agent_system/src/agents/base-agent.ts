import { Agent, InMemoryRunner, FunctionTool } from '@google/adk';
import { config } from '../config.js';
import { Blackboard } from '../orchestration/blackboard.js';
import { defaultToolRegistry, ToolRegistry } from '../tools/registry.js';
import {
  AgentConfigSpec,
  AgentMessage,
  AgentRole,
  ToolCallTrace,
} from '../types.js';

export abstract class BaseAgent {
  public id: string;
  public name: string;
  public role: AgentRole;
  public systemPrompt: string;
  public model: string;
  public temperature: number;
  public tools: string[];
  public color: string;
  public avatar: string;
  protected toolRegistry: ToolRegistry;
  protected adkAgent?: Agent;

  constructor(spec: AgentConfigSpec, toolRegistry: ToolRegistry = defaultToolRegistry) {
    this.id = spec.id;
    this.name = spec.name;
    this.role = spec.role;
    this.systemPrompt = spec.systemPrompt;
    this.model = spec.model || config.modelName;
    this.temperature = spec.temperature ?? 0.7;
    this.tools = spec.tools || [];
    this.color = spec.color || '#4f46e5';
    this.avatar = spec.avatar || '🤖';
    this.toolRegistry = toolRegistry;

    this.initAdkAgent();
  }

  protected initAdkAgent(): void {
    try {
      if (config.apiKey) {
        const adkTools: FunctionTool<any>[] = this.tools
          .map((name) => this.toolRegistry.getTool(name))
          .filter((t): t is NonNullable<typeof t> => !!t)
          .map(
            (t) =>
              new FunctionTool({
                name: t.declaration.name,
                description: t.declaration.description,
                execute: async (args: any) => t.execute(args),
              } as any)
          );

        this.adkAgent = new Agent({
          name: this.name,
          model: this.model,
          instruction: this.systemPrompt,
          tools: adkTools,
          generateContentConfig: {
            temperature: this.temperature,
          },
        });
      }
    } catch (err) {
      // Graceful fallback to simulation
    }
  }

  /**
   * Execute a full agent step within the multi-agent blackboard context
   */
  public async executeStep(
    prompt: string,
    blackboard: Blackboard,
    options?: { targetRecipient?: string; contextData?: Record<string, any> }
  ): Promise<AgentMessage> {
    const context = blackboard.getContext();

    // 1. Emit thinking trace event
    const thought = this.generateThought(prompt, blackboard);
    blackboard.emitEvent('agent_thought', { thought }, this.name);

    // 2. Perform relevant tool calls if applicable
    const toolCalls: ToolCallTrace[] = [];
    const neededTools = this.determineRequiredTools(prompt);
    for (const toolRequirement of neededTools) {
      blackboard.emitEvent('tool_called', { tool: toolRequirement.name, args: toolRequirement.args }, this.name);
      const trace = await this.toolRegistry.executeTool(toolRequirement.name, toolRequirement.args, context);
      toolCalls.push(trace);
      blackboard.emitEvent('tool_result', { tool: toolRequirement.name, result: trace.result || trace.error }, this.name);
    }

    // 3. Generate response
    let responseContent: string;
    if (config.apiKey && this.adkAgent) {
      responseContent = await this.callGeminiApi(prompt, blackboard, toolCalls);
    } else {
      responseContent = await this.simulateResponse(prompt, blackboard, toolCalls, thought);
    }

    // 4. Save to Blackboard & emit message
    const msg = blackboard.addMessage(
      this.name,
      'model',
      responseContent,
      thought,
      options?.targetRecipient || 'all',
      toolCalls,
      { role: this.role, agentId: this.id }
    );

    return msg;
  }

  protected async callGeminiApi(prompt: string, blackboard: Blackboard, toolTraces: ToolCallTrace[]): Promise<string> {
    try {
      const runner = new InMemoryRunner({
        agent: this.adkAgent!,
        appName: `gemini-multi-agent-${this.name.toLowerCase()}`,
      });

      const fullPrompt = `Task Context: ${blackboard.taskDescription}
Current Blackboard Artifacts: ${Array.from(blackboard.artifacts.keys()).join(', ') || 'None'}
Prior Messages:
${blackboard.messages.slice(-5).map((m) => `[${m.sender}]: ${m.content.slice(0, 300)}`).join('\n')}

Tool execution traces:
${JSON.stringify(toolTraces, null, 2)}

Instructions for ${this.name} (${this.role}):
${prompt}`;

      const events = runner.runEphemeral({
        userId: 'user',
        newMessage: {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
      });

      let accumulated = '';
      for await (const event of events) {
        if (event.content && event.content.parts) {
          for (const part of event.content.parts) {
            if ((part as any).text) {
              accumulated += (part as any).text;
            }
          }
        }
      }

      return accumulated || this.simulateResponse(prompt, blackboard, toolTraces, 'Fallback response generated');
    } catch (err) {
      return this.simulateResponse(prompt, blackboard, toolTraces, 'Gemini API call encountered an error, falling back.');
    }
  }

  /**
   * Internal reasoning / thought process simulation
   */
  protected abstract generateThought(prompt: string, blackboard: Blackboard): string;

  /**
   * Intelligent tool requirement analysis
   */
  protected abstract determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }>;

  /**
   * High-fidelity response generator (used for local mode / fallback / offline verification)
   */
  protected abstract simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string>;
}
