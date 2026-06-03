import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { StringEnum } from '@earendil-works/pi-ai';
import {
  type ExtensionAPI,
  getAgentDir,
  parseFrontmatter,
} from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

type AgentScope = 'user' | 'project' | 'both';

type AgentConfig = {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: 'user' | 'project';
  filePath: string;
};

type DiscoveryResult = {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
};

type ChildResult = {
  agent: string;
  agentSource: 'user' | 'project' | 'unknown';
  task: string;
  exitCode: number;
  output: string;
  stderr: string;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  step?: number;
};

type AvailableModel = {
  provider: string;
  id: string;
  name: string | undefined;
};

type ModelResolution = {
  cliModel?: string;
  displayModel?: string;
  error?: string;
};

type AgentActivity = {
  toolName: string;
  summary: string;
  status: 'running' | 'done' | 'error';
};

type AgentProgress = {
  agent: string;
  agentSource: 'user' | 'project' | 'unknown';
  model?: string;
  step?: number;
  status: 'starting' | 'running' | 'completed' | 'failed';
  activities: AgentActivity[];
  toolCount: number;
  latestText: string;
  exitCode?: number;
};

type ProgressCallback = (progress: AgentProgress) => void;

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const PER_TASK_OUTPUT_CAP_BYTES = 50 * 1024;
const MAX_RECENT_ACTIVITIES = 5;
const MAX_ACTIVITY_SUMMARY_CHARS = 100;
const MAX_LATEST_TEXT_CHARS = 240;
const PROGRESS_THROTTLE_MS = 150;
const THINKING_LEVELS = new Set<string>([
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]);

const taskItemSchema = Type.Object({
  agent: Type.String({ description: 'Name of the agent to invoke' }),
  task: Type.String({ description: 'Task to delegate to the agent' }),
  cwd: Type.Optional(
    Type.String({ description: 'Working directory for this child agent' }),
  ),
});

const subagentParamsSchema = Type.Object({
  agent: Type.Optional(
    Type.String({
      description: 'Name of the agent to invoke for single-agent mode',
    }),
  ),
  task: Type.Optional(
    Type.String({ description: 'Task to delegate for single-agent mode' }),
  ),
  tasks: Type.Optional(
    Type.Array(taskItemSchema, {
      description: 'Parallel tasks, each with an agent and task',
    }),
  ),
  chain: Type.Optional(
    Type.Array(taskItemSchema, {
      description:
        'Sequential tasks. Use {previous} in later task text to inject prior output',
    }),
  ),
  agentScope: Type.Optional(
    StringEnum(['user', 'project', 'both'] as const, {
      description:
        'Which agent directories to use. Default: user. Use project or both for .pi/agents.',
      default: 'user',
    }),
  ),
  confirmProjectAgents: Type.Optional(
    Type.Boolean({
      description: 'Prompt before running project-local agents. Default: true.',
      default: true,
    }),
  ),
  cwd: Type.Optional(
    Type.String({ description: 'Working directory for single-agent mode' }),
  ),
});

function parseTools(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    const tools = value
      .split(',')
      .map((tool) => tool.trim())
      .filter(Boolean);
    return tools.length > 0 ? tools : undefined;
  }

  if (Array.isArray(value) && value.every((tool) => typeof tool === 'string')) {
    return value.map((tool) => tool.trim()).filter(Boolean);
  }

  return undefined;
}

function formatAvailableModel(model: AvailableModel): string {
  const label = `${model.provider}/${model.id}`;
  if (!model.name || model.name === model.id) return label;

  return `${label} (${model.name})`;
}

function splitThinkingLevel(model: string): {
  model: string;
  thinkingSuffix: string;
} {
  const separator = model.lastIndexOf(':');
  if (separator === -1) return { model, thinkingSuffix: '' };

  const suffix = model.slice(separator + 1);
  if (!THINKING_LEVELS.has(suffix)) return { model, thinkingSuffix: '' };

  return {
    model: model.slice(0, separator),
    thinkingSuffix: `:${suffix}`,
  };
}

function uniqueAvailableModels(models: AvailableModel[]): AvailableModel[] {
  const seen = new Set<string>();
  const unique: AvailableModel[] = [];

  for (const model of models) {
    const key = `${model.provider}/${model.id}`;
    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(model);
  }

  return unique;
}

function resolveAgentModel(
  requestedModel: string | undefined,
  availableModels: AvailableModel[],
  availableModelsError?: string,
): ModelResolution {
  if (!requestedModel) return {};
  if (requestedModel.includes('/')) {
    return { cliModel: requestedModel, displayModel: requestedModel };
  }

  const { model, thinkingSuffix } = splitThinkingLevel(requestedModel);
  const matches = uniqueAvailableModels(
    availableModels.filter(
      (available) => available.id === model || available.name === model,
    ),
  );

  if (matches.length === 1) {
    const [match] = matches as [AvailableModel];
    const cliModel = `${match.provider}/${match.id}${thinkingSuffix}`;

    return {
      cliModel,
      displayModel:
        cliModel === requestedModel
          ? cliModel
          : `${requestedModel} -> ${cliModel}`,
    };
  }

  if (matches.length === 0) {
    if (availableModelsError) {
      return {
        error: `Could not resolve unqualified model "${requestedModel}" because available model lookup failed: ${availableModelsError}. Provider-qualify the agent model or retry after the registry recovers.`,
      };
    }

    return {
      error: `No available configured model matches "${requestedModel}". Use /login to add a provider or provider-qualify the agent model.`,
    };
  }

  return {
    error: `Ambiguous model "${requestedModel}" matched ${matches
      .map(formatAvailableModel)
      .join(', ')}. Provider-qualify the agent model.`,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;

  return 'unknown error';
}

function loadAgentsFromDir(
  dir: string,
  source: 'user' | 'project',
): AgentConfig[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const agents: AgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith('.md')) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    const content = fs.readFileSync(filePath, 'utf8');
    const { frontmatter, body } =
      parseFrontmatter<Record<string, unknown>>(content);

    if (
      typeof frontmatter.name !== 'string' ||
      typeof frontmatter.description !== 'string'
    )
      continue;

    const model =
      typeof frontmatter.model === 'string' && frontmatter.model.trim()
        ? frontmatter.model.trim()
        : undefined;

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: parseTools(frontmatter.tools),
      model,
      systemPrompt: body,
      source,
      filePath,
    });
  }

  return agents;
}

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function findProjectAgentsDir(cwd: string): string | null {
  let current = cwd;

  while (true) {
    const candidate = path.join(current, '.pi', 'agents');
    if (isDirectory(candidate)) return candidate;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function discoverAgents(cwd: string, scope: AgentScope): DiscoveryResult {
  const userAgentsDir = path.join(getAgentDir(), 'agents');
  const projectAgentsDir = findProjectAgentsDir(cwd);

  const userAgents =
    scope === 'project' ? [] : loadAgentsFromDir(userAgentsDir, 'user');
  const projectAgents =
    scope === 'user' || !projectAgentsDir
      ? []
      : loadAgentsFromDir(projectAgentsDir, 'project');
  const agentsByName = new Map<string, AgentConfig>();

  if (scope === 'both') {
    for (const agent of userAgents) agentsByName.set(agent.name, agent);
    for (const agent of projectAgents) agentsByName.set(agent.name, agent);
  } else {
    for (const agent of scope === 'project' ? projectAgents : userAgents)
      agentsByName.set(agent.name, agent);
  }

  return { agents: Array.from(agentsByName.values()), projectAgentsDir };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}

function extractAssistantText(message: unknown): string {
  const record = asRecord(message);
  if (!record || record.role !== 'assistant' || !Array.isArray(record.content))
    return '';

  const parts: string[] = [];
  for (const part of record.content) {
    const partRecord = asRecord(part);
    if (partRecord?.type === 'text' && typeof partRecord.text === 'string')
      parts.push(partRecord.text);
  }

  return parts.join('\n');
}

function getStringField(value: unknown, field: string): string | undefined {
  const record = asRecord(value);
  const fieldValue = record?.[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function truncateOutput(output: string): string {
  const bytes = Buffer.byteLength(output, 'utf8');
  if (bytes <= PER_TASK_OUTPUT_CAP_BYTES) return output;

  let truncated = output.slice(0, PER_TASK_OUTPUT_CAP_BYTES);
  while (Buffer.byteLength(truncated, 'utf8') > PER_TASK_OUTPUT_CAP_BYTES)
    truncated = truncated.slice(0, -1);

  return `${truncated}\n\n[Output truncated: ${bytes - Buffer.byteLength(truncated, 'utf8')} bytes omitted.]`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateInline(value: string, max: number): string {
  const collapsed = collapseWhitespace(value);
  if (collapsed.length <= max) return collapsed;
  return `${collapsed.slice(0, Math.max(0, max - 1))}\u2026`;
}

function summarizeToolArgs(toolName: string, args: unknown): string {
  const record = asRecord(args);
  if (!record) return '';

  const pickString = (...keys: string[]): string => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  };

  switch (toolName) {
    case 'bash':
      return truncateInline(
        pickString('command', 'description'),
        MAX_ACTIVITY_SUMMARY_CHARS,
      );
    case 'read':
    case 'write':
    case 'edit':
    case 'ls':
      return truncateInline(
        pickString('path', 'filePath', 'file'),
        MAX_ACTIVITY_SUMMARY_CHARS,
      );
    case 'grep':
    case 'find':
      return truncateInline(
        pickString('pattern', 'query', 'path'),
        MAX_ACTIVITY_SUMMARY_CHARS,
      );
    case 'subagent':
      return truncateInline(
        pickString('agent', 'task'),
        MAX_ACTIVITY_SUMMARY_CHARS,
      );
    default: {
      const preview = pickString(
        'task',
        'query',
        'pattern',
        'command',
        'path',
        'filePath',
        'url',
        'name',
      );
      return preview ? truncateInline(preview, MAX_ACTIVITY_SUMMARY_CHARS) : '';
    }
  }
}

function formatActivity(activity: AgentActivity): string {
  const marker =
    activity.status === 'done'
      ? '\u2713'
      : activity.status === 'error'
        ? '\u2717'
        : '\u2026';
  const body = activity.summary
    ? `${activity.toolName}: ${activity.summary}`
    : activity.toolName;
  return `  ${marker} ${body}`;
}

function formatProgress(progress: AgentProgress): string {
  const lines: string[] = [];
  const stepLabel = progress.step ? `[step ${progress.step}] ` : '';
  const modelLabel = progress.model ? ` \u2022 ${progress.model}` : '';
  const sourceLabel =
    progress.agentSource !== 'unknown' ? ` (${progress.agentSource})` : '';
  const statusLabel =
    progress.status === 'completed'
      ? 'completed'
      : progress.status === 'failed'
        ? `failed${progress.exitCode != null ? ` (exit ${progress.exitCode})` : ''}`
        : progress.status === 'starting'
          ? 'starting'
          : 'running';

  lines.push(
    `### ${stepLabel}${progress.agent}${sourceLabel}${modelLabel} \u2014 ${statusLabel}`,
  );

  if (progress.toolCount > 0) {
    lines.push(`Tool calls: ${progress.toolCount}`);
  }

  if (progress.activities.length > 0) {
    lines.push('');
    for (const activity of progress.activities)
      lines.push(formatActivity(activity));
  }

  if (progress.latestText) {
    lines.push('');
    lines.push(
      `> ${truncateInline(progress.latestText, MAX_LATEST_TEXT_CHARS)}`,
    );
  }

  return lines.join('\n');
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript =
    currentScript?.startsWith('/$bunfs/root/') ?? false;

  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const executableName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(executableName);
  if (!isGenericRuntime) return { command: process.execPath, args };

  return { command: 'pi', args };
}

type TempFile = { dir: string; file: string };

async function writeTempFile(
  prefix: string,
  name: string,
  content: string,
): Promise<TempFile> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix));
  const safeName = name.replace(/[^a-zA-Z0-9_.-]+/g, '_');
  const file = path.join(dir, `${safeName}.md`);
  await fsp.writeFile(file, content, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return { dir, file };
}

async function removeTempFile(tempFile: TempFile | null): Promise<void> {
  if (!tempFile) return;

  await fsp.rm(tempFile.file, { force: true });
  await fsp.rm(tempFile.dir, { recursive: true, force: true });
}

async function runAgent(params: {
  defaultCwd: string;
  agents: AgentConfig[];
  availableModels: AvailableModel[];
  availableModelsError?: string;
  agentName: string;
  task: string;
  cwd?: string;
  step?: number;
  signal?: AbortSignal;
  onProgress?: ProgressCallback;
}): Promise<ChildResult> {
  const agent = params.agents.find(
    (candidate) => candidate.name === params.agentName,
  );
  if (!agent) {
    const available =
      params.agents.map((candidate) => candidate.name).join(', ') || 'none';
    params.onProgress?.({
      agent: params.agentName,
      agentSource: 'unknown',
      step: params.step,
      status: 'failed',
      activities: [],
      toolCount: 0,
      latestText: `Unknown agent "${params.agentName}".`,
      exitCode: 1,
    });
    return {
      agent: params.agentName,
      agentSource: 'unknown',
      task: params.task,
      exitCode: 1,
      output: '',
      stderr: `Unknown agent "${params.agentName}". Available agents: ${available}.`,
      step: params.step,
    };
  }

  const modelResolution = resolveAgentModel(
    agent.model,
    params.availableModels,
    params.availableModelsError,
  );
  if (modelResolution.error) {
    params.onProgress?.({
      agent: agent.name,
      agentSource: agent.source,
      model: agent.model,
      step: params.step,
      status: 'failed',
      activities: [],
      toolCount: 0,
      latestText: modelResolution.error,
      exitCode: 1,
    });

    return {
      agent: agent.name,
      agentSource: agent.source,
      task: params.task,
      exitCode: 1,
      output: '',
      stderr: modelResolution.error,
      model: agent.model,
      step: params.step,
    };
  }

  const args = ['--mode', 'json', '-p', '--no-session'];
  if (modelResolution.cliModel) args.push('--model', modelResolution.cliModel);
  if (agent.tools && agent.tools.length > 0)
    args.push('--tools', agent.tools.join(','));

  const tempPrompt = agent.systemPrompt.trim()
    ? await writeTempFile('pi-subagent-system-', agent.name, agent.systemPrompt)
    : null;
  if (tempPrompt) args.push('--append-system-prompt', tempPrompt.file);

  const tempTask = await writeTempFile(
    'pi-subagent-task-',
    `${agent.name}-task`,
    `Task:\n\n${params.task}`,
  );
  args.push(`@${tempTask.file}`);

  const result: ChildResult = {
    agent: agent.name,
    agentSource: agent.source,
    task: params.task,
    exitCode: 0,
    output: '',
    stderr: '',
    model: modelResolution.cliModel,
    step: params.step,
  };

  const progress: AgentProgress = {
    agent: agent.name,
    agentSource: agent.source,
    model: modelResolution.displayModel,
    step: params.step,
    status: 'starting',
    activities: [],
    toolCount: 0,
    latestText: '',
  };
  const activeByToolCallId = new Map<string, AgentActivity>();

  const emitProgress = (): void => {
    params.onProgress?.({
      ...progress,
      activities: [...progress.activities],
    });
  };

  emitProgress();

  try {
    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const child = spawn(invocation.command, invocation.args, {
        cwd: params.cwd ?? params.defaultCwd,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdoutBuffer = '';
      let aborted = false;
      let childClosed = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | undefined;
      let abortHandler: VoidFunction | undefined;
      let progressDirty = false;
      let progressTimer: ReturnType<typeof setTimeout> | undefined;
      let lastProgressAt = 0;

      const flushProgress = (): void => {
        if (progressTimer) {
          clearTimeout(progressTimer);
          progressTimer = undefined;
        }
        if (!progressDirty) return;
        progressDirty = false;
        lastProgressAt = Date.now();
        emitProgress();
      };

      const scheduleProgress = (): void => {
        if (!params.onProgress) return;
        progressDirty = true;
        const delay = PROGRESS_THROTTLE_MS - (Date.now() - lastProgressAt);
        if (delay <= 0) {
          if (progressTimer) {
            clearTimeout(progressTimer);
            progressTimer = undefined;
          }
          flushProgress();
          return;
        }
        progressTimer ??= setTimeout(() => {
          progressTimer = undefined;
          flushProgress();
        }, delay);
      };

      const trimRecentActivities = (): void => {
        if (progress.activities.length <= MAX_RECENT_ACTIVITIES) return;
        progress.activities.splice(
          0,
          progress.activities.length - MAX_RECENT_ACTIVITIES,
        );
      };

      const handleToolStart = (
        toolCallId: string,
        toolName: string,
        toolArgs: unknown,
      ): void => {
        progress.status = 'running';
        progress.toolCount += 1;
        const activity: AgentActivity = {
          toolName,
          summary: summarizeToolArgs(toolName, toolArgs),
          status: 'running',
        };
        progress.activities.push(activity);
        trimRecentActivities();
        if (toolCallId) activeByToolCallId.set(toolCallId, activity);
        scheduleProgress();
      };

      const handleToolEnd = (toolCallId: string, isError: boolean): void => {
        const activity = activeByToolCallId.get(toolCallId);
        if (activity) {
          activity.status = isError ? 'error' : 'done';
          activeByToolCallId.delete(toolCallId);
        }
        scheduleProgress();
      };

      const handleAssistantMessage = (message: unknown): void => {
        const text = extractAssistantText(message);
        if (text) progress.latestText = text;
        const model = getStringField(message, 'model');
        if (model) progress.model = model;
      };

      const processLine = (line: string): void => {
        if (!line.trim()) return;

        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        const eventRecord = asRecord(event);
        if (!eventRecord) return;

        switch (eventRecord.type) {
          case 'message_start': {
            progress.status = 'running';
            const model = getStringField(eventRecord.message, 'model');
            if (model) progress.model = model;
            scheduleProgress();
            return;
          }
          case 'message_update': {
            handleAssistantMessage(eventRecord.message);
            scheduleProgress();
            return;
          }
          case 'tool_execution_start': {
            const toolCallId =
              typeof eventRecord.toolCallId === 'string'
                ? eventRecord.toolCallId
                : '';
            const toolName =
              typeof eventRecord.toolName === 'string'
                ? eventRecord.toolName
                : 'tool';
            handleToolStart(toolCallId, toolName, eventRecord.args);
            return;
          }
          case 'tool_execution_end': {
            const toolCallId =
              typeof eventRecord.toolCallId === 'string'
                ? eventRecord.toolCallId
                : '';
            handleToolEnd(toolCallId, Boolean(eventRecord.isError));
            return;
          }
          case 'message_end': {
            const text = extractAssistantText(eventRecord.message);
            if (text) {
              result.output = text;
              progress.latestText = text;
            }

            result.stopReason =
              getStringField(eventRecord.message, 'stopReason') ??
              result.stopReason;
            result.errorMessage =
              getStringField(eventRecord.message, 'errorMessage') ??
              result.errorMessage;
            result.model =
              getStringField(eventRecord.message, 'model') ?? result.model;
            if (result.model) progress.model = result.model;
            scheduleProgress();
            return;
          }
          default:
            return;
        }
      };

      child.stdout.on('data', (data: Buffer) => {
        stdoutBuffer += data.toString('utf8');
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';
        for (const line of lines) processLine(line);
      });

      child.stderr.on('data', (data: Buffer) => {
        result.stderr += data.toString('utf8');
      });

      child.on('error', (error) => {
        childClosed = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        if (progressTimer) {
          clearTimeout(progressTimer);
          progressTimer = undefined;
        }
        if (abortHandler && params.signal)
          params.signal.removeEventListener('abort', abortHandler);
        result.stderr += error.message;
        resolve(1);
      });

      child.on('close', (code) => {
        childClosed = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        if (progressTimer) {
          clearTimeout(progressTimer);
          progressTimer = undefined;
        }
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);
        if (abortHandler && params.signal)
          params.signal.removeEventListener('abort', abortHandler);
        flushProgress();
        resolve(aborted ? 130 : (code ?? 0));
      });

      if (params.signal) {
        abortHandler = () => {
          if (childClosed) return;
          aborted = true;
          child.kill('SIGTERM');
          forceKillTimer = setTimeout(() => {
            if (
              !childClosed &&
              child.exitCode === null &&
              child.signalCode === null
            )
              child.kill('SIGKILL');
          }, 5000);
        };

        if (params.signal.aborted) abortHandler();
        else
          params.signal.addEventListener('abort', abortHandler, { once: true });
      }
    });

    result.exitCode =
      exitCode === 0 &&
      (result.stopReason === 'error' || result.stopReason === 'aborted')
        ? 1
        : exitCode;
    progress.status = result.exitCode === 0 ? 'completed' : 'failed';
    progress.exitCode = result.exitCode;
    emitProgress();
    return result;
  } finally {
    await removeTempFile(tempPrompt);
    await removeTempFile(tempTask);
  }
}

async function mapWithConcurrencyLimit<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  callback: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  await Promise.all(
    new Array(Math.min(concurrency, items.length))
      .fill(undefined)
      .map(async () => {
        while (nextIndex < items.length) {
          const index = nextIndex;
          nextIndex += 1;
          results[index] = await callback(items[index], index);
        }
      }),
  );

  return results;
}

function summarizeResult(result: ChildResult): string {
  const status =
    result.exitCode === 0 ? 'completed' : `failed (exit ${result.exitCode})`;
  const body =
    result.output || result.errorMessage || result.stderr || '(no output)';
  return `### ${result.agent} ${status}\n\n${truncateOutput(body)}`;
}

function formatAvailableAgents(agents: AgentConfig[]): string {
  if (agents.length === 0) return 'none';
  return agents
    .map((agent) => `${agent.name} (${agent.source}): ${agent.description}`)
    .join('\n');
}

export default function nhostSubagentExtension(pi: ExtensionAPI): void {
  pi.registerTool({
    name: 'subagent',
    label: 'Subagent',
    description: [
      'Delegate tasks to specialized Pi agents in isolated pi subprocesses.',
      'Supports single mode (agent + task), parallel mode (tasks array), and chain mode (chain array with {previous}).',
      'Project agents live in .pi/agents and require agentScope "project" or "both".',
    ].join(' '),
    promptSnippet:
      'Delegate work to project or user Pi agents with isolated context windows',
    promptGuidelines: [
      'Use the subagent tool when a workflow asks you to delegate to a named Pi agent from .pi/agents or ~/.pi/agent/agents.',
      'Use subagent with agentScope "project" for this repository\'s native review agents.',
      'Do not run subagent implementers in parallel when they may edit files; use sequential single calls or chain mode instead.',
    ],
    parameters: subagentParamsSchema,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const agentScope: AgentScope = params.agentScope ?? 'user';
      const discovery = discoverAgents(ctx.cwd, agentScope);
      const agents = discovery.agents;

      const hasSingle = Boolean(params.agent && params.task);
      const hasParallel = (params.tasks?.length ?? 0) > 0;
      const hasChain = (params.chain?.length ?? 0) > 0;
      const modeCount =
        Number(hasSingle) + Number(hasParallel) + Number(hasChain);

      if (modeCount !== 1) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Invalid subagent request. Provide exactly one mode.\n\nAvailable agents:\n${formatAvailableAgents(agents)}`,
            },
          ],
          details: { results: [] },
        };
      }

      const requestedNames = new Set<string>();
      if (params.agent) requestedNames.add(params.agent);
      for (const task of params.tasks ?? []) requestedNames.add(task.agent);
      for (const task of params.chain ?? []) requestedNames.add(task.agent);

      const requestedAgents = Array.from(requestedNames)
        .map((name) => agents.find((agent) => agent.name === name))
        .filter((agent): agent is AgentConfig => Boolean(agent));
      const projectAgentsRequested = requestedAgents.filter(
        (agent) => agent.source === 'project',
      );

      if (
        (params.confirmProjectAgents ?? true) &&
        projectAgentsRequested.length > 0 &&
        ctx.hasUI
      ) {
        const names = projectAgentsRequested
          .map((agent) => agent.name)
          .join(', ');
        const ok = await ctx.ui.confirm(
          'Run project-local Pi agents?',
          `Agents: ${names}\nSource: ${discovery.projectAgentsDir ?? '(unknown)'}\n\nOnly continue for repositories you trust.`,
        );

        if (!ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Canceled: project-local agents were not approved.',
              },
            ],
            details: { results: [] },
          };
        }
      }

      const emitUpdate = (text: string): void => {
        if (!onUpdate) return;
        onUpdate({
          content: [{ type: 'text' as const, text }],
          details: undefined,
        });
      };

      let availableModels: AvailableModel[] = [];
      let availableModelsError: string | undefined;
      if (
        requestedAgents.some((agent) =>
          Boolean(agent.model && !agent.model.includes('/')),
        )
      ) {
        try {
          const models = await ctx.modelRegistry.getAvailable();
          availableModels = models.map((model) => ({
            provider: model.provider,
            id: model.id,
            name: model.name,
          }));
        } catch (error: unknown) {
          availableModelsError = getErrorMessage(error);
        }
      }

      if (hasSingle && params.agent && params.task) {
        const result = await runAgent({
          defaultCwd: ctx.cwd,
          agents,
          availableModels,
          availableModelsError,
          agentName: params.agent,
          task: params.task,
          cwd: params.cwd,
          signal,
          onProgress: (progress) => {
            emitUpdate(formatProgress(progress));
          },
        });

        return {
          content: [
            {
              type: 'text' as const,
              text:
                result.output ||
                result.errorMessage ||
                result.stderr ||
                '(no output)',
            },
          ],
          details: { results: [result] },
        };
      }

      if (hasChain && params.chain) {
        const results: ChildResult[] = [];
        let previous = '';
        const stepProgress: (AgentProgress | undefined)[] = new Array(
          params.chain.length,
        ).fill(undefined);

        const renderChain = (): string =>
          stepProgress
            .map((entry, index) => {
              if (entry) return formatProgress(entry);
              const item = params.chain?.[index];
              if (!item) return '';
              return `### [step ${index + 1}] ${item.agent} \u2014 pending`;
            })
            .filter(Boolean)
            .join('\n\n---\n\n');

        for (const [index, item] of params.chain.entries()) {
          const task = item.task.replaceAll('{previous}', previous);
          const result = await runAgent({
            defaultCwd: ctx.cwd,
            agents,
            availableModels,
            availableModelsError,
            agentName: item.agent,
            task,
            cwd: item.cwd,
            step: index + 1,
            signal,
            onProgress: (progress) => {
              stepProgress[index] = progress;
              emitUpdate(renderChain());
            },
          });
          results.push(result);

          if (result.exitCode !== 0) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Chain stopped at step ${index + 1}.\n\n${summarizeResult(result)}`,
                },
              ],
              details: { results },
            };
          }

          previous = result.output;
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: results.map(summarizeResult).join('\n\n---\n\n'),
            },
          ],
          details: { results },
        };
      }

      if (hasParallel && params.tasks) {
        if (params.tasks.length > MAX_PARALLEL_TASKS) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Too many parallel tasks (${params.tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
              },
            ],
            details: { results: [] },
          };
        }

        const parallelProgress: (AgentProgress | undefined)[] = new Array(
          params.tasks.length,
        ).fill(undefined);

        const renderParallel = (): string =>
          parallelProgress
            .map((entry, index) => {
              if (entry) return formatProgress(entry);
              const item = params.tasks?.[index];
              if (!item) return '';
              return `### ${item.agent} \u2014 pending`;
            })
            .filter(Boolean)
            .join('\n\n---\n\n');

        const results = await mapWithConcurrencyLimit(
          params.tasks,
          MAX_CONCURRENCY,
          (item, index) =>
            runAgent({
              defaultCwd: ctx.cwd,
              agents,
              availableModels,
              availableModelsError,
              agentName: item.agent,
              task: item.task,
              cwd: item.cwd,
              signal,
              onProgress: (progress) => {
                parallelProgress[index] = progress;
                emitUpdate(renderParallel());
              },
            }),
        );

        const succeeded = results.filter(
          (result) => result.exitCode === 0,
        ).length;
        return {
          content: [
            {
              type: 'text' as const,
              text: `Parallel subagents: ${succeeded}/${results.length} succeeded\n\n${results.map(summarizeResult).join('\n\n---\n\n')}`,
            },
          ],
          details: { results },
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: `Invalid subagent request.\n\nAvailable agents:\n${formatAvailableAgents(agents)}`,
          },
        ],
        details: { results: [] },
      };
    },
  });
}
