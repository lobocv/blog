// The tools Claude calls during a turn, as a small MCP server over HTTP (JSON-RPC, JSON
// responses, no sessions). Served by the editor itself, so a tool call lands in the process that
// owns the threads. See docs/decisions/2026-11-25-serve-the-editors-mcp-tools-over-http.md.
import type { Thread } from '../domain/thread.ts';

type Handlers = {
  suggestEdit: (
    slug: string,
    s: { threadId: string; find: string; replace: string; reason: string; mechanical?: boolean },
  ) => Promise<Thread[]>;
  reportReview: (slug: string, r: { title: string; done: number; total: number }) => Promise<Thread[]>;
  /** Tells the open editor about the change straight away, before Claude's turn ends. */
  changed: (slug: string, threads: Thread[]) => void;
};

type Rpc = { jsonrpc: '2.0'; id?: string | number; method: string; params?: Record<string, any> };

const TOOLS = [
  {
    name: 'suggest_edit',
    description:
      "Propose an edit to the post. It appears in the thread for Calvin to accept, tweak or reject; you can't change the post yourself. " +
      '`find` must be the exact words from the post as it is now (read it first), as short as is unambiguous. ' +
      'One suggestion per call. Put the reason in `reason`, not in your reply.',
    inputSchema: {
      type: 'object',
      properties: {
        thread_id: { type: 'string', description: 'The thread the suggestion answers, as named in the message.' },
        find: { type: 'string', description: 'The exact text to replace.' },
        replace: { type: 'string', description: 'The new text.' },
        reason: { type: 'string', description: 'Why, in one short sentence.' },
        mechanical: {
          type: 'boolean',
          description: 'True for a mechanical fix (typo, spacing, punctuation, capitalisation), which Calvin can accept along with all the others at once.',
        },
      },
      required: ['thread_id', 'find', 'replace', 'reason'],
    },
  },
  {
    name: 'review_progress',
    description:
      'Report progress through a checklist (eg a critique), shown to Calvin as "<title> · <done> of <total>". ' +
      'Call it when you start (done: 0) and after each item.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'eg "Line critique"' },
        done: { type: 'integer', minimum: 0 },
        total: { type: 'integer', minimum: 1 },
      },
      required: ['title', 'done', 'total'],
    },
  },
];

/** The tool names Claude is allowed to call without asking, as Claude Code names them. */
export const TOOL_NAMES = TOOLS.map((t) => `mcp__editor__${t.name}`);

export function createMcpHandler({ suggestEdit, reportReview, changed }: Handlers) {
  async function call(slug: string, msg: Rpc): Promise<object | undefined> {
    const ok = (result: object) => ({ jsonrpc: '2.0', id: msg.id, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
    if (msg.id === undefined) return undefined; // a notification: nothing to answer

    switch (msg.method) {
      case 'initialize':
        return ok({
          protocolVersion: msg.params?.protocolVersion ?? '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'writing-editor', version: '1' },
        });
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({ tools: TOOLS });
      case 'tools/call': {
        const { name, arguments: a = {} } = msg.params ?? {};
        const text = (s: string, isError = false) => ok({ content: [{ type: 'text', text: s }], isError });
        const run = async (work: () => Promise<Thread[]>, done: string) => {
          try {
            changed(slug, await work());
            return text(done);
          } catch (err) {
            return text((err as Error).message, true);
          }
        };
        if (name === 'suggest_edit') {
          if (![a.thread_id, a.find, a.replace, a.reason].every((v) => typeof v === 'string')) {
            return text('thread_id, find, replace and reason are all required strings.', true);
          }
          const s = { threadId: a.thread_id, find: a.find, replace: a.replace, reason: a.reason, mechanical: a.mechanical === true };
          return run(() => suggestEdit(slug, s), 'Suggested. Calvin will accept, tweak or reject it.');
        }
        if (name === 'review_progress') {
          if (typeof a.title !== 'string' || typeof a.done !== 'number' || typeof a.total !== 'number') {
            return text('title (string), done and total (numbers) are required.', true);
          }
          return run(() => reportReview(slug, { title: a.title, done: a.done, total: a.total }), 'Noted.');
        }
        return fail(-32602, `Unknown tool "${name}".`);
      }
      default:
        return fail(-32601, `Unknown method "${msg.method}".`);
    }
  }

  /** Handles one HTTP request to /mcp/<slug>. */
  return async (slug: string, req: Request): Promise<Response> => {
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: { allow: 'POST' } });
    let body: Rpc | Rpc[];
    try {
      body = await req.json();
    } catch {
      return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
    }
    const replies = (await Promise.all((Array.isArray(body) ? body : [body]).map((m) => call(slug, m)))).filter(Boolean);
    if (!replies.length) return new Response(null, { status: 202 });
    return Response.json(Array.isArray(body) ? replies : replies[0]);
  };
}
