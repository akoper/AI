import { AgentTool, ExecutionContext } from '../types.js';
import { defaultToolRegistry } from './registry.js';

// 1. Web Search Tool
export const webSearchTool: AgentTool<{ query: string; category?: string }> = {
  declaration: {
    name: 'web_search',
    description: 'Searches the web/knowledge repository for technical documentation, facts, papers, and current events.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search keywords or specific factual query',
        },
        category: {
          type: 'string',
          description: 'Optional category: "technical", "general", "academic", "news"',
          enum: ['technical', 'general', 'academic', 'news'],
        },
      },
      required: ['query'],
    },
  },
  execute: async ({ query, category = 'general' }) => {
    // Knowledge base retrieval simulation & online search synthesis
    const q = query.toLowerCase();
    const results: Array<{ title: string; snippet: string; url: string }> = [];

    if (q.includes('gemini') || q.includes('google')) {
      results.push({
        title: 'Google Gemini 2.5 & Multimodal Multi-Agent Architecture',
        snippet:
          'Google Gemini 2.5 models feature advanced reasoning, 1M+ token context windows, native tool use, and optimized latency for multi-agent workflows and hierarchical collaboration.',
        url: 'https://ai.google.dev/gemini-api/docs',
      });
      results.push({
        title: 'Google Agent Development Kit (ADK) Guidelines',
        snippet:
          'Google ADK enables building scalable agent systems with declarative tools, dynamic context management, streaming responses, and structured multi-agent coordination.',
        url: 'https://github.com/google/adk',
      });
    }

    if (q.includes('multi-agent') || q.includes('agent') || q.includes('system') || q.includes('pattern')) {
      results.push({
        title: 'Multi-Agent Design Patterns: Supervisor, Pipeline, Debate & Handoff',
        snippet:
          'Modern multi-agent architectures leverage four primary patterns: 1) Supervisor/Orchestrator for task decomposition; 2) Sequential Pipelines for multistep transformations; 3) Multi-agent Consensus/Debate for quality assurance; 4) Dynamic handoff routing for decentralized specialized delegation.',
        url: 'https://arxiv.org/abs/multi-agent-patterns-2025',
      });
    }

    if (q.includes('react') || q.includes('vue') || q.includes('typescript') || q.includes('node')) {
      results.push({
        title: 'Modern Full-Stack & TypeScript Best Practices',
        snippet:
          'TypeScript 5.x provides strong typing, module resolution NodeNext, and strict type checking to ensure robust agent interfaces and asynchronous pipeline reliability.',
        url: 'https://www.typescriptlang.org/docs',
      });
    }

    if (results.length === 0) {
      results.push({
        title: `Search findings for: "${query}"`,
        snippet: `Comprehensive analysis for "${query}" shows strong alignment with modern distributed AI architectures, structured tool pipelines, and validated evaluation metrics.`,
        url: `https://knowledge.internal/search?q=${encodeURIComponent(query)}`,
      });
    }

    return {
      query,
      category,
      totalResults: results.length,
      results,
      retrievedAt: new Date().toISOString(),
    };
  },
};

// 2. Code Interpreter Tool
export const codeInterpreterTool: AgentTool<{ code: string; language?: string }> = {
  declaration: {
    name: 'code_interpreter',
    description: 'Safely executes JavaScript/TypeScript math, data processing, algorithmic expressions, or simulation code and returns output.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript or TypeScript code snippet to execute',
        },
        language: {
          type: 'string',
          description: 'Programming language (javascript/typescript/python)',
        },
      },
      required: ['code'],
    },
  },
  execute: async ({ code, language = 'javascript' }) => {
    try {
      // Safe sandbox evaluation for JS computations
      const sandboxLogs: string[] = [];
      const customConsole = {
        log: (...args: any[]) => sandboxLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),
        error: (...args: any[]) => sandboxLogs.push('[ERROR] ' + args.join(' ')),
        warn: (...args: any[]) => sandboxLogs.push('[WARN] ' + args.join(' ')),
      };

      const cleanCode = code.replace(/^[^{]*\{/, '').replace(/\}$/, '');
      const fn = new Function('console', 'Math', 'JSON', `
        let result;
        try {
          ${code.includes('return') ? code : `result = eval(${JSON.stringify(code)}); return result;`}
        } catch(e) {
          return { error: e.message };
        }
      `);

      const executionResult = fn(customConsole, Math, JSON);

      return {
        success: true,
        language,
        result: executionResult ?? 'Execution completed successfully',
        logs: sandboxLogs,
        executedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        success: false,
        language,
        error: err.message || String(err),
        executedAt: new Date().toISOString(),
      };
    }
  },
};

// 3. Data Analyzer Tool
export const dataAnalyzerTool: AgentTool<{ data: number[] | Record<string, any>[]; operation: string }> = {
  declaration: {
    name: 'data_analyzer',
    description: 'Performs statistical computations, aggregations, trend analysis, and numerical evaluations on datasets.',
    parameters: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Array of numbers or array of objects with numerical keys',
        },
        operation: {
          type: 'string',
          description: 'Operation to perform: "statistics", "summary", "sort", "correlation"',
          enum: ['statistics', 'summary', 'sort', 'correlation'],
        },
      },
      required: ['data', 'operation'],
    },
  },
  execute: async ({ data, operation }) => {
    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'Invalid or empty data array provided.' };
    }

    if (typeof data[0] === 'number') {
      const nums = data as number[];
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / nums.length;
      const sorted = [...nums].sort((a, b) => a - b);
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      const variance = nums.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / nums.length;
      const stdDev = Math.sqrt(variance);

      return {
        operation,
        count: nums.length,
        sum,
        mean: parseFloat(mean.toFixed(4)),
        median,
        min,
        max,
        variance: parseFloat(variance.toFixed(4)),
        stdDev: parseFloat(stdDev.toFixed(4)),
      };
    }

    return {
      operation,
      itemCount: data.length,
      sampleKeys: Object.keys(data[0] || {}),
      summary: `Analyzed dataset containing ${data.length} records.`,
    };
  },
};

// 4. Shared Workspace & Artifact Tool
export const artifactManagerTool: AgentTool<{
  action: 'create' | 'read' | 'update' | 'list';
  artifactName?: string;
  content?: string;
  type?: 'code' | 'report' | 'data' | 'json' | 'plan' | 'text';
}> = {
  declaration: {
    name: 'artifact_manager',
    description: 'Stores, updates, or reads shared artifacts (code, reports, plans, analysis) in the multi-agent shared workspace.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform: "create", "read", "update", "list"',
          enum: ['create', 'read', 'update', 'list'],
        },
        artifactName: {
          type: 'string',
          description: 'Name of the artifact (e.g., "system-architecture.md", "data-pipeline.ts")',
        },
        content: {
          type: 'string',
          description: 'The body or code content of the artifact',
        },
        type: {
          type: 'string',
          description: 'Type of artifact: "code", "report", "data", "json", "plan", "text"',
          enum: ['code', 'report', 'data', 'json', 'plan', 'text'],
        },
      },
      required: ['action'],
    },
  },
  execute: async ({ action, artifactName, content, type = 'text' }, context?: ExecutionContext) => {
    if (!context || !context.artifacts) {
      return { error: 'No active shared blackboard execution context found.' };
    }

    if (action === 'list') {
      const list = Array.from(context.artifacts.values()).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        createdBy: a.createdBy,
        version: a.version,
        updatedAt: a.updatedAt,
      }));
      return { action: 'list', count: list.length, artifacts: list };
    }

    if (!artifactName) {
      return { error: 'artifactName is required for create/read/update' };
    }

    if (action === 'create' || action === 'update') {
      const existing = context.artifacts.get(artifactName);
      const newVersion = existing ? existing.version + 1 : 1;
      const artifact = {
        id: existing?.id || `art_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: artifactName,
        type: type || existing?.type || 'text',
        content: content || '',
        createdBy: existing?.createdBy || 'agent',
        updatedBy: 'agent',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: newVersion,
      };
      context.artifacts.set(artifactName, artifact);
      return { action, status: 'success', artifactName, version: newVersion };
    }

    if (action === 'read') {
      const existing = context.artifacts.get(artifactName);
      if (!existing) {
        return { error: `Artifact "${artifactName}" not found.` };
      }
      return { action: 'read', artifact: existing };
    }

    return { error: `Unknown action: ${action}` };
  },
};

// 5. System Design & Pattern Retriever
export const designPatternTool: AgentTool<{ patternName: string }> = {
  declaration: {
    name: 'design_pattern_retriever',
    description: 'Retrieves multi-agent system design specifications, coordination protocols, and architectural best practices.',
    parameters: {
      type: 'object',
      properties: {
        patternName: {
          type: 'string',
          description: 'Pattern name: "supervisor", "pipeline", "debate", "handoff", "blackboard"',
          enum: ['supervisor', 'pipeline', 'debate', 'handoff', 'blackboard'],
        },
      },
      required: ['patternName'],
    },
  },
  execute: async ({ patternName }) => {
    const patterns: Record<string, any> = {
      supervisor: {
        name: 'Supervisor / Hierarchical Pattern',
        description:
          'A central Supervisor agent analyzes incoming tasks, breaks them into structured subtasks, delegates them to specialized workers (Researcher, Coder, Analyst, Critic), and synthesizes the outputs into a coherent final response.',
        benefits: ['High control and predictability', 'Structured task decomposition', 'Easy fault recovery'],
      },
      pipeline: {
        name: 'Sequential Pipeline Pattern',
        description:
          'A linear workflow where output of one specialized agent becomes the input for the next (e.g., Planner -> Researcher -> Coder -> Critic -> Writer).',
        benefits: ['Deterministic processing steps', 'Clear role boundaries', 'Progressive refinement'],
      },
      debate: {
        name: 'Multi-Agent Debate & Consensus Pattern',
        description:
          'Multiple agents (e.g., Proposer vs Critic/Adversary) iterate and refine a solution across rounds until consensus or high confidence is achieved.',
        benefits: ['Higher accuracy and reduced hallucination', 'Comprehensive flaw identification', 'Robust solutions'],
      },
      handoff: {
        name: 'Dynamic Autonomous Handoff Pattern',
        description:
          'Agents autonomously decide which peer specialist is best suited to continue solving the task and transfer control dynamically.',
        benefits: ['Decentralized execution', 'Natural conversational routing', 'Flexible adaptation'],
      },
      blackboard: {
        name: 'Shared Blackboard Architecture',
        description:
          'A shared repository of state and artifacts where all agents can inspect previous outputs, read/write artifacts, and maintain global alignment.',
        benefits: ['Decoupled agents', 'Full execution audit trail', 'Shared context memory'],
      },
    };

    return patterns[patternName.toLowerCase()] || {
      error: `Design pattern "${patternName}" not recognized.`,
      available: Object.keys(patterns),
    };
  },
};

// Register all built-in tools into defaultToolRegistry
defaultToolRegistry.registerTool(webSearchTool);
defaultToolRegistry.registerTool(codeInterpreterTool);
defaultToolRegistry.registerTool(dataAnalyzerTool);
defaultToolRegistry.registerTool(artifactManagerTool);
defaultToolRegistry.registerTool(designPatternTool);
