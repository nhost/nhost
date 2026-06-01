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

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const PER_TASK_OUTPUT_CAP_BYTES = 50 * 1024;

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
  agentName: string;
  task: string;
  cwd?: string;
  step?: number;
  signal?: AbortSignal;
}): Promise<ChildResult> {
  const agent = params.agents.find(
    (candidate) => candidate.name === params.agentName,
  );
  if (!agent) {
    const available =
      params.agents.map((candidate) => candidate.name).join(', ') || 'none';
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

  const args = ['--mode', 'json', '-p', '--no-session'];
  if (agent.model) args.push('--model', agent.model);
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
    model: agent.model,
    step: params.step,
  };

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

      const processLine = (line: string): void => {
        if (!line.trim()) return;

        let event: unknown;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        const eventRecord = asRecord(event);
        if (!eventRecord || eventRecord.type !== 'message_end') return;

        const text = extractAssistantText(eventRecord.message);
        if (text) result.output = text;

        result.stopReason =
          getStringField(eventRecord.message, 'stopReason') ??
          result.stopReason;
        result.errorMessage =
          getStringField(eventRecord.message, 'errorMessage') ??
          result.errorMessage;
        result.model =
          getStringField(eventRecord.message, 'model') ?? result.model;
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
        if (abortHandler && params.signal)
          params.signal.removeEventListener('abort', abortHandler);
        result.stderr += error.message;
        resolve(1);
      });

      child.on('close', (code) => {
        childClosed = true;
        if (forceKillTimer) clearTimeout(forceKillTimer);
        if (stdoutBuffer.trim()) processLine(stdoutBuffer);
        if (abortHandler && params.signal)
          params.signal.removeEventListener('abort', abortHandler);
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

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
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

      const projectAgentsRequested = Array.from(requestedNames)
        .map((name) => agents.find((agent) => agent.name === name))
        .filter((agent): agent is AgentConfig => agent?.source === 'project');

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

      if (hasSingle && params.agent && params.task) {
        const result = await runAgent({
          defaultCwd: ctx.cwd,
          agents,
          agentName: params.agent,
          task: params.task,
          cwd: params.cwd,
          signal,
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

        for (const [index, item] of params.chain.entries()) {
          const task = item.task.replaceAll('{previous}', previous);
          const result = await runAgent({
            defaultCwd: ctx.cwd,
            agents,
            agentName: item.agent,
            task,
            cwd: item.cwd,
            step: index + 1,
            signal,
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

        const results = await mapWithConcurrencyLimit(
          params.tasks,
          MAX_CONCURRENCY,
          (item) =>
            runAgent({
              defaultCwd: ctx.cwd,
              agents,
              agentName: item.agent,
              task: item.task,
              cwd: item.cwd,
              signal,
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
