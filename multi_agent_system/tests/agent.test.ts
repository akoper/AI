import assert from 'node:assert';
import { describe, it } from 'node:test';
import { defaultToolRegistry, ToolRegistry } from '../src/tools/registry.js';
import '../src/tools/built-in-tools.js';
import { Blackboard } from '../src/orchestration/blackboard.js';
import {
  SupervisorAgent,
  ResearcherAgent,
  CoderAgent,
  AnalystAgent,
  CriticAgent,
  WriterAgent,
} from '../src/agents/specialized-agents.js';
import { MultiAgentCoordinator } from '../src/orchestration/coordinator.js';
import { createServer } from '../src/server.js';

describe('Google Gemini Multi-Agent System Test Suite', () => {
  describe('1. Tool Registry & Built-in Tools', () => {
    it('should have all 5 core tools registered', () => {
      const decls = defaultToolRegistry.getDeclarations();
      const toolNames = decls.map((d) => d.name);
      assert.ok(toolNames.includes('web_search'));
      assert.ok(toolNames.includes('code_interpreter'));
      assert.ok(toolNames.includes('data_analyzer'));
      assert.ok(toolNames.includes('artifact_manager'));
      assert.ok(toolNames.includes('design_pattern_retriever'));
    });

    it('should execute web_search tool correctly', async () => {
      const result = await defaultToolRegistry.executeTool('web_search', {
        query: 'Google Gemini multi-agent systems',
      });
      assert.strictEqual(result.error, undefined);
      assert.ok(result.result.totalResults > 0);
      assert.ok(result.result.results[0].title.includes('Gemini') || result.result.results[0].title.includes('Multi-Agent'));
    });

    it('should execute code_interpreter tool and return computed result', async () => {
      const result = await defaultToolRegistry.executeTool('code_interpreter', {
        code: 'const a = 15; const b = 27; return a * b;',
        language: 'javascript',
      });
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.result.success, true);
      assert.strictEqual(result.result.result, 405);
    });

    it('should execute data_analyzer tool with statistical calculations', async () => {
      const result = await defaultToolRegistry.executeTool('data_analyzer', {
        data: [10, 20, 30, 40, 50],
        operation: 'statistics',
      });
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.result.count, 5);
      assert.strictEqual(result.result.mean, 30);
      assert.strictEqual(result.result.median, 30);
      assert.strictEqual(result.result.min, 10);
      assert.strictEqual(result.result.max, 50);
    });

    it('should retrieve design patterns using design_pattern_retriever', async () => {
      const result = await defaultToolRegistry.executeTool('design_pattern_retriever', {
        patternName: 'supervisor',
      });
      assert.strictEqual(result.error, undefined);
      assert.ok(result.result.name.includes('Supervisor'));
    });
  });

  describe('2. Blackboard State & Artifact Store', () => {
    it('should track subtasks, messages, and artifact versioning', () => {
      const blackboard = new Blackboard('test_task_1', 'Test Objective');

      // Add subtasks
      const sub1 = blackboard.addSubtask('Initial Subtask', 'Do step 1', 'Researcher');
      assert.strictEqual(sub1.status, 'pending');

      blackboard.updateSubtaskStatus(sub1.id, 'in_progress');
      assert.strictEqual(sub1.status, 'in_progress');

      blackboard.updateSubtaskStatus(sub1.id, 'completed', 'Step 1 complete');
      assert.strictEqual(sub1.status, 'completed');
      assert.strictEqual(sub1.result, 'Step 1 complete');

      // Add messages
      const msg = blackboard.addMessage('Researcher', 'model', 'Found technical docs', 'Searching web');
      assert.strictEqual(msg.sender, 'Researcher');
      assert.strictEqual(blackboard.messages.length, 1);

      // Save artifacts with version incrementing
      const art1 = blackboard.saveArtifact('spec.md', '# Spec v1', 'report', 'Researcher');
      assert.strictEqual(art1.version, 1);

      const art2 = blackboard.saveArtifact('spec.md', '# Spec v2', 'report', 'Coder');
      assert.strictEqual(art2.version, 2);
      assert.strictEqual(blackboard.getAllArtifacts().length, 1);
      assert.strictEqual(blackboard.getArtifact('spec.md')?.content, '# Spec v2');
    });
  });

  describe('3. Specialized Gemini Agents Execution', () => {
    it('should execute Researcher agent and create research artifact', async () => {
      const researcher = new ResearcherAgent();
      const blackboard = new Blackboard('test_research', 'Investigate Gemini Multi-Agent');
      const msg = await researcher.executeStep('Research Gemini ADK capabilities', blackboard);

      assert.strictEqual(msg.sender, 'Researcher');
      assert.ok(msg.content.includes('Research Findings'));
      assert.ok(blackboard.getArtifact('research_brief.md') !== undefined);
    });

    it('should execute Coder agent and create TypeScript module artifact', async () => {
      const coder = new CoderAgent();
      const blackboard = new Blackboard('test_code', 'Implement rate limiter pipeline');
      const msg = await coder.executeStep('Implement TaskExecutionPipeline', blackboard);

      assert.strictEqual(msg.sender, 'Coder');
      assert.ok(msg.content.includes('Implementation'));
      assert.ok(blackboard.getArtifact('implementation_module.ts') !== undefined);
    });

    it('should execute Critic agent and perform review critique', async () => {
      const critic = new CriticAgent();
      const blackboard = new Blackboard('test_critique', 'Review multi-agent system');
      const msg = await critic.executeStep('Review code and architecture', blackboard);

      assert.strictEqual(msg.sender, 'Critic');
      assert.ok(msg.content.includes('Peer Review'));
    });
  });

  describe('4. Multi-Agent Workflows & Coordination', () => {
    it('should execute Supervisor / Hierarchical Workflow end-to-end', async () => {
      const coordinator = new MultiAgentCoordinator();
      const result = await coordinator.runTask({
        task: 'Build and evaluate a fault-tolerant payment processor',
        workflowType: 'supervisor',
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.workflowType, 'supervisor');
      assert.ok(result.agentsInvolved.includes('Supervisor'));
      assert.ok(result.agentsInvolved.includes('Researcher'));
      assert.ok(result.agentsInvolved.includes('Coder'));
      assert.ok(result.agentsInvolved.includes('Analyst'));
      assert.ok(result.agentsInvolved.includes('Critic'));
      assert.ok(result.artifacts.length > 0);
      assert.ok(result.finalAnswer.length > 50);
      assert.ok(result.durationMs >= 0);
    });

    it('should execute Sequential Pipeline Workflow end-to-end', async () => {
      const coordinator = new MultiAgentCoordinator();
      const result = await coordinator.runTask({
        task: 'Design real-time data ingestion architecture',
        workflowType: 'pipeline',
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.workflowType, 'pipeline');
      assert.ok(result.subtasks.length >= 5);
      assert.ok(result.messages.length >= 5);
    });

    it('should execute Multi-Agent Debate & Consensus Workflow', async () => {
      const coordinator = new MultiAgentCoordinator();
      const result = await coordinator.runTask({
        task: 'Determine optimal consensus algorithm for distributed agents',
        workflowType: 'debate',
        maxRounds: 2,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.workflowType, 'debate');
      assert.ok(result.metrics.totalRounds >= 1);
    });

    it('should execute Dynamic Autonomous Handoff Workflow', async () => {
      const coordinator = new MultiAgentCoordinator();
      const result = await coordinator.runTask({
        task: 'Create end-to-end agentic analytics dashboard',
        workflowType: 'handoff',
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.workflowType, 'handoff');
      assert.ok(result.agentsInvolved.length >= 3);
      const handoffEvents = result.events.filter((e) => e.type === 'agent_handoff');
      assert.ok(handoffEvents.length > 0);
    });
  });

  describe('5. Express Server & REST API Handlers', () => {
    it('should initialize Express server with all routes', () => {
      const { app, server, wss } = createServer();
      assert.ok(app !== undefined);
      assert.ok(server !== undefined);
      assert.ok(wss !== undefined);
    });
  });
});
