import { BaseAgent } from './base-agent.js';
import { Blackboard } from '../orchestration/blackboard.js';
import { ToolCallTrace } from '../types.js';

// ==========================================
// 1. SUPERVISOR AGENT
// ==========================================
export class SupervisorAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_supervisor',
      name: 'Supervisor',
      role: 'supervisor',
      systemPrompt: `You are the Lead Supervisor & Multi-Agent Orchestrator powered by Google Gemini.
Your responsibilities:
1. Analyze complex user requests and break them into clear, actionable subtasks.
2. Delegate work to specialized agents: Researcher, Coder, Analyst, Critic, and Writer.
3. Monitor execution progress across the shared blackboard.
4. Synthesize all findings and specialist contributions into a comprehensive final answer.`,
      tools: ['design_pattern_retriever', 'artifact_manager'],
      color: '#4f46e5',
      avatar: '👑',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Analyzing task requirements: "${blackboard.taskDescription.slice(0, 80)}...". Determining specialist delegation plan and required coordination stages.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [
      {
        name: 'design_pattern_retriever',
        args: { patternName: 'supervisor' },
      },
    ];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const isSynthesis = prompt.toLowerCase().includes('synthesize') || prompt.toLowerCase().includes('final');

    if (isSynthesis) {
      const messagesSummary = blackboard.messages
        .filter((m) => m.sender !== 'Supervisor' && m.sender !== 'user')
        .map((m) => `### 🤖 Contribution from ${m.sender}:\n${m.content}`)
        .join('\n\n');

      const artifactsSummary = blackboard.getAllArtifacts().map(a => `- **${a.name}** (${a.type}, v${a.version})`).join('\n');

      return `## 🎯 Final Orchestrated Solution

### Executive Overview
The multi-agent system has completed execution for the task:
> "${blackboard.taskDescription}"

### 🛠️ Specialist Contributions & Synthesis
${messagesSummary || 'All specialist agents have executed their assigned subtasks successfully.'}

${artifactsSummary ? `### 📦 Generated Artifacts\n${artifactsSummary}\n` : ''}

### ✨ Key Conclusions & Recommended Next Steps
- The solution was analyzed, implemented, mathematically validated, and peer-reviewed by specialized Gemini agents.
- All edge cases, system performance factors, and architectural standards have been verified.`;
    }

    return `I have reviewed the objective: "${blackboard.taskDescription}".
I am decomposing this mission into parallel and sequential subtasks across our specialist agents:
1. **Researcher**: Gather facts, architectural references, and state-of-the-art benchmarks.
2. **Coder**: Implement robust code logic, types, and operational components.
3. **Analyst**: Compute performance metrics, statistical validation, and operational data.
4. **Critic**: Evaluate solution completeness, edge cases, and code quality.
5. **Writer**: Format the consolidated deliverable.`;
  }
}

// ==========================================
// 2. RESEARCHER AGENT
// ==========================================
export class ResearcherAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_researcher',
      name: 'Researcher',
      role: 'researcher',
      systemPrompt: `You are the Lead Researcher Agent powered by Google Gemini.
Your responsibilities:
1. Query knowledge bases and web resources for domain knowledge, technical documentation, and best practices.
2. Extract accurate facts, references, and architectural benchmarks.
3. Provide structured research summaries and save research notes to the shared blackboard.`,
      tools: ['web_search', 'artifact_manager'],
      color: '#0891b2',
      avatar: '🔍',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Formulating optimal research queries for: "${prompt.slice(0, 60)}". Cross-referencing technical docs and design standards.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [
      {
        name: 'web_search',
        args: { query: prompt.slice(0, 50), category: 'technical' },
      },
    ];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const searchResult = toolTraces.find((t) => t.toolName === 'web_search')?.result;
    const findings = searchResult?.results
      ? searchResult.results.map((r: any) => `- **${r.title}**: ${r.snippet}`).join('\n')
      : '- Verified multi-agent coordination patterns with Google Gemini ADK and dynamic tool pipelines.';

    // Save research artifact to blackboard
    blackboard.saveArtifact(
      'research_brief.md',
      `# Research Brief: ${prompt}\n\n${findings}`,
      'report',
      this.name
    );

    return `### 🔬 Research Findings & Technical Context
Based on web and knowledge base retrieval for "${prompt.slice(0, 60)}":

${findings}

**Key Architectural Insights:**
1. Leverage specialized prompt boundaries to maximize model efficiency and avoid role leakage.
2. Use shared state (Blackboard) for zero-latency inter-agent data passing.
3. Maintain structured function declarations to ensure reliable tool use.`;
  }
}

// ==========================================
// 3. CODER AGENT
// ==========================================
export class CoderAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_coder',
      name: 'Coder',
      role: 'coder',
      systemPrompt: `You are the Senior Software Engineer Agent powered by Google Gemini.
Your responsibilities:
1. Write production-ready, clean, typed, modular TypeScript, JavaScript, or Python code.
2. Execute code snippets and verify algorithmic logic via code_interpreter.
3. Save developed code modules into shared workspace artifacts.`,
      tools: ['code_interpreter', 'artifact_manager'],
      color: '#16a34a',
      avatar: '💻',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Engineering code solution for: "${prompt.slice(0, 60)}". Designing modular interface, type definitions, and algorithmic execution.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [
      {
        name: 'code_interpreter',
        args: {
          code: `const start = Date.now();
const computeEngine = (n) => {
  let acc = 0;
  for(let i = 1; i <= n; i++) acc += (i * 1.5) % 100;
  return { processedItems: n, score: Math.round(acc * 100) / 100, durationMs: Date.now() - start };
};
computeEngine(50);`,
        },
      },
    ];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const codeSnippet = `/**
 * Implementation Module for: ${prompt.slice(0, 50)}
 * Multi-Agent System Engine with Google Gemini
 */

export interface AgentProcessingConfig {
  concurrency: number;
  timeoutMs: number;
  retryAttempts: number;
}

export class TaskExecutionPipeline {
  private config: AgentProcessingConfig;

  constructor(config?: Partial<AgentProcessingConfig>) {
    this.config = {
      concurrency: 4,
      timeoutMs: 30000,
      retryAttempts: 3,
      ...config,
    };
  }

  public async processTask<TInput, TOutput>(
    input: TInput,
    processor: (data: TInput) => Promise<TOutput>
  ): Promise<{ success: boolean; data?: TOutput; error?: string }> {
    try {
      const result = await processor(input);
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err.message || 'Execution error' };
    }
  }
}`;

    blackboard.saveArtifact('implementation_module.ts', codeSnippet, 'code', this.name);

    return `### 💻 Implementation & Engineering Details

I have developed the core solution for the requested task:

\`\`\`typescript
${codeSnippet}
\`\`\`

**Implementation Highlights:**
- Strict typing with generic input/output interfaces.
- Error boundary handling and configurable retry resilience.
- Saved artifact \`implementation_module.ts\` to the shared blackboard.`;
  }
}

// ==========================================
// 4. ANALYST AGENT
// ==========================================
export class AnalystAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_analyst',
      name: 'Analyst',
      role: 'analyst',
      systemPrompt: `You are the Quantitative & Data Analyst Agent powered by Google Gemini.
Your responsibilities:
1. Analyze datasets, statistical metrics, performance data, and system throughput.
2. Execute data analytics operations (mean, variance, trends, sorting, comparisons).
3. Provide quantitative evidence and data-driven insights.`,
      tools: ['data_analyzer', 'artifact_manager'],
      color: '#d97706',
      avatar: '📊',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Conducting statistical and quantitative breakdown for: "${prompt.slice(0, 60)}". Running numerical evaluation.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [
      {
        name: 'data_analyzer',
        args: {
          data: [98.5, 99.1, 97.8, 99.4, 98.9, 99.6, 99.2],
          operation: 'statistics',
        },
      },
    ];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const stats = toolTraces.find((t) => t.toolName === 'data_analyzer')?.result || {
      mean: 98.93,
      median: 99.1,
      min: 97.8,
      max: 99.6,
      stdDev: 0.58,
    };

    const analysisReport = `| Metric | Value | Description |
|---|---|---|
| **Sample Size (N)** | 7 | Benchmark runs |
| **Mean Performance** | ${stats.mean}% | Average operational score |
| **Median** | ${stats.median}% | Central tendency |
| **Min / Max Range** | [${stats.min}%, ${stats.max}%] | Variance envelope |
| **Std Deviation** | ${stats.stdDev} | Low deviation = high consistency |`;

    blackboard.saveArtifact('analytics_report.md', analysisReport, 'data', this.name);

    return `### 📊 Quantitative Analysis & Performance Evaluation

I evaluated the operational metrics and benchmark data:

${analysisReport}

**Analytical Conclusion:**
- Performance metrics exhibit **99.1% consistency** across benchmark cycles.
- Low variance (stdDev: ${stats.stdDev}) indicates resilient and predictable agent performance.`;
  }
}

// ==========================================
// 5. CRITIC AGENT
// ==========================================
export class CriticAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_critic',
      name: 'Critic',
      role: 'critic',
      systemPrompt: `You are the Lead Critic & Quality Assurance Evaluator powered by Google Gemini.
Your responsibilities:
1. Rigorously review code, research, data, and proposals from other agents.
2. Identify security risks, edge cases, logical gaps, and performance bottlenecks.
3. Suggest concrete improvements or give explicit approval if quality standards are met.`,
      tools: ['artifact_manager'],
      color: '#e11d48',
      avatar: '🛡️',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Conducting rigorous peer review on blackboard outputs. Checking for security risks, race conditions, edge cases, and documentation accuracy.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [
      {
        name: 'artifact_manager',
        args: { action: 'list' },
      },
    ];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const artifactsCount = blackboard.getAllArtifacts().length;

    return `### 🛡️ Peer Review & Quality Assurance Critique

**Evaluation of Current Solution & Artifacts (${artifactsCount} artifacts reviewed):**

1. **Functional Integrity:** ✅ PASSED
   - Core TypeScript implementation conforms to strict typing standards.
   - Algorithmic logic tested with error boundary safeguards.

2. **Security & Guardrails:** ✅ PASSED
   - Zero unsanitized dynamic evals in production code paths.
   - Clean parameter schemas protect against prompt injection and tool misuse.

3. **Performance & Scalability:** ✅ PASSED
   - Asynchronous non-blocking architecture allows high multi-agent throughput.
   - Shared Blackboard ensures O(1) state lookup and auditability.

**Overall Verdict:** APPROVED (Score: 9.8/10) - Ready for production integration.`;
  }
}

// ==========================================
// 6. WRITER AGENT
// ==========================================
export class WriterAgent extends BaseAgent {
  constructor() {
    super({
      id: 'agent_writer',
      name: 'Writer',
      role: 'writer',
      systemPrompt: `You are the Technical Writer & Documentation Specialist powered by Google Gemini.
Your responsibilities:
1. Synthesize all technical information, data, and code into elegant, structured Markdown documentation.
2. Produce executive summaries, architectural diagrams, and user-facing manuals.
3. Ensure formatting clarity, readability, and professional presentation.`,
      tools: ['artifact_manager'],
      color: '#8b5cf6',
      avatar: '✍️',
    });
  }

  protected generateThought(prompt: string, blackboard: Blackboard): string {
    return `Synthesizing complete multi-agent deliverables into a clean, executive-ready Markdown publication.`;
  }

  protected determineRequiredTools(prompt: string): Array<{ name: string; args: Record<string, any> }> {
    return [];
  }

  protected async simulateResponse(
    prompt: string,
    blackboard: Blackboard,
    toolTraces: ToolCallTrace[],
    thought: string
  ): Promise<string> {
    const doc = `# Multi-Agent Solution Report: ${blackboard.taskDescription}

## 1. Executive Summary
This report summarizes the collective output of the Google Gemini Multi-Agent System across research, engineering, quantitative analysis, and peer critique.

## 2. Technical Architecture
- **Coordination Pattern:** ${blackboard.workflowType.toUpperCase()}
- **Agents Deployed:** Supervisor, Researcher, Coder, Analyst, Critic, Writer
- **Execution Engine:** Google Gemini & Google ADK

## 3. Deliverables Summary
- Structured research findings saved to shared workspace.
- Production TypeScript code module generated and validated.
- Statistical data benchmarked at >98.9% reliability.
- Full security and quality sign-off completed by Critic.`;

    blackboard.saveArtifact('final_report.md', doc, 'report', this.name);

    return `### ✍️ Final Documentation Deliverable
I have compiled the comprehensive deliverables into \`final_report.md\`.

${doc}`;
  }
}
