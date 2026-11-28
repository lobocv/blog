// Runs Claude Code headless (`claude -p`) for each turn, with Calvin's own login, and reads its
// stream-json output. The post is blocked from Claude's Edit and Write tools.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { Agent, AgentEvent, AgentTurn } from '../app/ports.ts';
import { EDITOR_SYSTEM_PROMPT } from '../domain/prompt.ts';
import { TOOL_NAMES } from './mcp-tools.ts';

/**
 * Turns stream-json lines into what the editor shows: the reply so far (the text of Claude's
 * latest message, so "Let me read the post" before a tool call is replaced by the answer) and
 * the tool it's using. Subagent output (parent_tool_use_id set) is left out.
 */
export class StreamReader {
  session: string | undefined;
  result: { text: string; error: boolean } | undefined;
  #text = '';

  /** The events for one line of output. */
  read(line: string): AgentEvent[] {
    let msg: Record<string, any>;
    try {
      msg = JSON.parse(line);
    } catch {
      return [];
    }
    if (msg.session_id) this.session = msg.session_id;
    if (msg.type === 'result') {
      this.result = { text: typeof msg.result === 'string' ? msg.result : this.#text, error: Boolean(msg.is_error) };
      return [];
    }
    if (msg.type !== 'stream_event' || msg.parent_tool_use_id) return [];
    const e = msg.event ?? {};
    if (e.type === 'message_start') this.#text = '';
    if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') return [{ type: 'tool', name: e.content_block.name }];
    if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta') {
      this.#text += e.delta.text;
      return [{ type: 'text', text: this.#text }];
    }
    return [];
  }

  /** The reply so far, for a turn that was stopped before its result. */
  get text() {
    return this.#text;
  }
}

export class ClaudeAgent implements Agent {
  readonly #root: string;
  readonly #command: string;

  /** `command` is the claude executable; tests pass a script that replays a recorded stream. */
  constructor(root: string, command = 'claude') {
    this.#root = root;
    this.#command = command;
  }

  async ask(turn: AgentTurn, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
    const first = await this.#run(turn, onEvent, signal);
    // A session can disappear (eg cleared from ~/.claude). Start a new one rather than fail.
    if (first.error && turn.session && !first.stopped && !first.text) {
      return this.#run({ ...turn, session: undefined }, onEvent, signal);
    }
    if (first.error && !first.stopped) throw new Error(first.text || 'Claude stopped without replying.');
    return first;
  }

  #run(turn: AgentTurn, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
    const args = [
      '-p',
      turn.prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--append-system-prompt',
      turn.system ?? EDITOR_SYSTEM_PROMPT,
      '--disallowedTools',
      'Edit(src/content/posts/**)',
      'Write(src/content/posts/**)',
      'NotebookEdit',
      // Only the editor's tools: Calvin's other MCP servers would slow every turn down.
      ...(turn.tools
        ? ['--mcp-config', JSON.stringify({ mcpServers: { editor: { type: 'http', url: turn.tools } } }), '--strict-mcp-config']
        : []),
      // Figure components are code Claude may change without asking (see EDITOR_SYSTEM_PROMPT).
      // Anything else that needs permission is refused, since nobody is there to answer.
      '--allowedTools',
      ...(turn.allow ?? [...(turn.tools ? TOOL_NAMES : []), 'Edit(src/components/**)', 'Write(src/components/**)']),
      ...(turn.session ? ['--resume', turn.session] : []),
    ];
    // Started from inside a Claude Code session (eg while testing), the CLI would think it's nested.
    const { CLAUDECODE: _, ...env } = process.env;
    const child = spawn(this.#command, args, { cwd: this.#root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = () => child.kill('SIGINT');
    signal.addEventListener('abort', stop);

    const reader = new StreamReader();
    let stderr = '';
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));
    createInterface({ input: child.stdout }).on('line', (line) => reader.read(line).forEach(onEvent));

    return new Promise<{ text: string; session?: string; stopped: boolean; error: boolean }>((done, fail) => {
      child.on('error', (err) => fail(new Error(`Couldn't run ${this.#command}: ${err.message}`)));
      child.on('close', (code) => {
        signal.removeEventListener('abort', stop);
        const stopped = signal.aborted;
        const result = reader.result;
        const error = !stopped && (result ? result.error : code !== 0);
        const text = result && !result.error ? result.text : error ? (result?.text || stderr.trim()) : reader.text;
        done({ text, session: reader.session, stopped, error });
      });
    });
  }
}
