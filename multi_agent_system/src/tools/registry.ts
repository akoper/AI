import { AgentTool, AgentToolDeclaration, ExecutionContext, ToolCallTrace } from '../types.js';

export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  public registerTool(tool: AgentTool): void {
    this.tools.set(tool.declaration.name, tool);
  }

  public getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  public getDeclarations(toolNames?: string[]): AgentToolDeclaration[] {
    if (!toolNames) {
      return Array.from(this.tools.values()).map((t) => t.declaration);
    }
    return toolNames
      .map((name) => this.tools.get(name)?.declaration)
      .filter((d): d is AgentToolDeclaration => !!d);
  }

  public async executeTool(
    name: string,
    args: Record<string, any>,
    context?: ExecutionContext
  ): Promise<ToolCallTrace> {
    const startTime = Date.now();
    const traceId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        id: traceId,
        toolName: name,
        args,
        error: `Tool "${name}" is not registered in ToolRegistry`,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const result = await tool.execute(args, context);
      return {
        id: traceId,
        toolName: name,
        args,
        result,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        id: traceId,
        toolName: name,
        args,
        error: err.message || String(err),
        durationMs: Date.now() - startTime,
      };
    }
  }
}

export const defaultToolRegistry = new ToolRegistry();
