import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentEvent } from '../app/ports.ts';
import { ClaudeAgent, StreamReader } from './claude-agent.ts';

const data = join(import.meta.dirname, 'testdata');
const fake = join(data, 'fake-claude.mjs');
const lines = async (name: string) => (await readFile(join(data, name), 'utf8')).split('\n').filter(Boolean);

describe('StreamReader, on recorded streams', () => {
  it('streams a reply and reads the session and result', async () => {
    const reader = new StreamReader();
    const events = (await lines('reply.jsonl')).flatMap((l) => reader.read(l));
    expect(events).toEqual([
      { type: 'text', text: 'Two short sentences.' },
      { type: 'text', text: 'Two short sentences. Nothing else.' },
    ]);
    expect(reader.session).toBe('00000000-0000-4000-8000-000000000001');
    expect(reader.result).toEqual({ text: 'Two short sentences. Nothing else.', error: false });
  });

  it('reports the tool Claude uses before it replies', async () => {
    const reader = new StreamReader();
    const events = (await lines('tool-then-reply.jsonl')).flatMap((l) => reader.read(l));
    expect(events[0]).toEqual({ type: 'tool', name: 'Read' });
    expect(events.at(-1)).toEqual({ type: 'text', text: 'The secret word is lantern.' });
  });

  it('ignores lines that are not JSON', () => {
    expect(new StreamReader().read('Warning: something')).toEqual([]);
  });
});

describe('ClaudeAgent, with a fake claude', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  async function ask(opts: { stream: string; delay?: number; session?: string; tools?: string; failResume?: boolean; stopOnText?: boolean }) {
    const argsFile = join(await mkdtemp(join(tmpdir(), 'claude-')), 'args');
    Object.assign(process.env, {
      FAKE_CLAUDE_STREAM: join(data, opts.stream),
      FAKE_CLAUDE_DELAY: String(opts.delay ?? 0),
      FAKE_CLAUDE_ARGS: argsFile,
      ...(opts.failResume ? { FAKE_CLAUDE_FAIL_RESUME: '1' } : {}),
    });
    const controller = new AbortController();
    const events: AgentEvent[] = [];
    const onEvent = (e: AgentEvent) => {
      events.push(e);
      if (opts.stopOnText && e.type === 'text') controller.abort();
    };
    const result = await new ClaudeAgent(tmpdir(), fake).ask({ prompt: 'hi', session: opts.session, tools: opts.tools }, onEvent, controller.signal);
    const calls = (await readFile(argsFile, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as string[]);
    return { result, events, calls };
  }

  it('runs claude headless with the post blocked from edits, and returns the reply', async () => {
    const { result, calls } = await ask({ stream: 'reply.jsonl' });
    expect(result).toEqual({ text: 'Two short sentences. Nothing else.', session: '00000000-0000-4000-8000-000000000001', stopped: false, error: false });
    expect(calls[0]).toEqual(expect.arrayContaining(['-p', 'hi', '--output-format', 'stream-json', 'Edit(src/content/posts/**)']));
    expect(calls[0]).not.toContain('--resume');
  });

  it("gives Claude only the editor's tools when there are some", async () => {
    const { calls } = await ask({ stream: 'reply.jsonl', tools: 'http://127.0.0.1:4401/mcp/a' });
    const config = calls[0][calls[0].indexOf('--mcp-config') + 1];
    expect(JSON.parse(config)).toEqual({ mcpServers: { editor: { type: 'http', url: 'http://127.0.0.1:4401/mcp/a' } } });
    expect(calls[0]).toEqual(expect.arrayContaining(['--strict-mcp-config', 'mcp__editor__suggest_edit']));
  });

  it('resumes the session it is given', async () => {
    const { calls } = await ask({ stream: 'reply.jsonl', session: 'abc' });
    expect(calls[0].slice(-2)).toEqual(['--resume', 'abc']);
  });

  it('starts a new session when the old one is gone', async () => {
    const { result, calls } = await ask({ stream: 'reply.jsonl', session: 'gone', failResume: true });
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toContain('--resume');
    expect(result.text).toBe('Two short sentences. Nothing else.');
  });

  it('stops, keeping the reply so far', async () => {
    // The next line of text comes two lines (200ms) later, long after the stop.
    const { result } = await ask({ stream: 'reply.jsonl', delay: 100, stopOnText: true });
    expect(result.stopped).toBe(true);
    expect(result.text).toBe('Two short sentences.');
  });

  it('fails clearly when claude cannot be run', async () => {
    const agent = new ClaudeAgent(tmpdir(), '/no/such/claude');
    await expect(agent.ask({ prompt: 'hi' }, () => {}, new AbortController().signal)).rejects.toThrow("Couldn't run /no/such/claude");
  });
});

// The one test that talks to the real Claude. Costs a little, so only with EDITOR_LIVE=1.
const live = process.env.EDITOR_LIVE === '1' && spawnSync('claude', ['--version']).status === 0;
describe.runIf(live)('ClaudeAgent, live', () => {
  it('gets a reply and a session, then resumes it', async () => {
    const agent = new ClaudeAgent(await mkdtemp(join(tmpdir(), 'live-')));
    const signal = new AbortController().signal;
    const first = await agent.ask({ prompt: 'Remember the word "lantern". Reply with just: ok' }, () => {}, signal);
    expect(first.session).toBeTruthy();
    const second = await agent.ask({ prompt: 'What word did I ask you to remember? One word.', session: first.session }, () => {}, signal);
    expect(second.text.toLowerCase()).toContain('lantern');
  }, 120_000);
});
