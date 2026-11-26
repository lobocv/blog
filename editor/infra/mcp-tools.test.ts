import { describe, expect, it } from 'vitest';
import type { Thread } from '../domain/thread.ts';
import { createMcpHandler } from './mcp-tools.ts';

function setup(fail?: string) {
  const calls: unknown[] = [];
  const changed: unknown[] = [];
  const mcp = createMcpHandler({
    suggestEdit: async (slug, s) => {
      calls.push([slug, s]);
      if (fail) throw new Error(fail);
      return [] as Thread[];
    },
    changed: (slug) => changed.push(slug),
  });
  const rpc = (body: object) => mcp('a', new Request('http://x/mcp/a', { method: 'POST', body: JSON.stringify(body) }));
  return { rpc, calls, changed, mcp };
}

const call = (args: object) => ({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'suggest_edit', arguments: args } });
const args = { thread_id: 't1', find: 'incredible', replace: 'a lot', reason: 'Plainer.' };

describe('MCP tools', () => {
  it('initializes with the version the client asks for, and lists suggest_edit', async () => {
    const { rpc } = setup();
    const init = await (await rpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })).json();
    expect(init.result).toMatchObject({ protocolVersion: '2025-11-25', capabilities: { tools: {} } });
    const list = await (await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['suggest_edit']);
  });

  it('answers a notification with 202 and no body', async () => {
    expect((await setup().rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
  });

  it('passes a suggestion on and tells the editor', async () => {
    const { rpc, calls, changed } = setup();
    const res = await (await rpc(call(args))).json();
    expect(res.result).toEqual({ content: [{ type: 'text', text: 'Suggested. Calvin will accept, tweak or reject it.' }], isError: false });
    expect(calls).toEqual([['a', { threadId: 't1', find: 'incredible', replace: 'a lot', reason: 'Plainer.' }]]);
    expect(changed).toEqual(['a']);
  });

  it('returns a refused suggestion as a tool error Claude can read', async () => {
    const res = await (await setup('`find` is not in the post').rpc(call(args))).json();
    expect(res.result).toMatchObject({ isError: true, content: [{ text: '`find` is not in the post' }] });
  });

  it('rejects missing arguments, unknown tools and unknown methods', async () => {
    const { rpc } = setup();
    expect((await (await rpc(call({ thread_id: 't1' }))).json()).result.isError).toBe(true);
    expect((await (await rpc({ ...call(args), params: { name: 'nope' } })).json()).error.code).toBe(-32602);
    expect((await (await rpc({ jsonrpc: '2.0', id: 9, method: 'nope' })).json()).error.code).toBe(-32601);
  });

  it('only takes POST', async () => {
    expect((await setup().mcp('a', new Request('http://x/mcp/a'))).status).toBe(405);
  });
});
