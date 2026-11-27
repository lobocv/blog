import { describe, expect, it } from 'vitest';
import type { Thread } from '../domain/thread.ts';
import type { ShareState } from '../domain/social/social-post.ts';
import { createMcpHandler, createShareMcpHandler, SHARE_TOOL_NAMES } from './mcp-tools.ts';

function setup(fail?: string) {
  const calls: unknown[] = [];
  const changed: unknown[] = [];
  const mcp = createMcpHandler({
    suggestEdit: async (slug, s) => {
      calls.push([slug, s]);
      if (fail) throw new Error(fail);
      return [] as Thread[];
    },
    reportReview: async (slug, r) => {
      calls.push([slug, r]);
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
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['suggest_edit', 'review_progress']);
  });

  it('answers a notification with 202 and no body', async () => {
    expect((await setup().rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);
  });

  it('passes a suggestion on and tells the editor', async () => {
    const { rpc, calls, changed } = setup();
    const res = await (await rpc(call(args))).json();
    expect(res.result).toEqual({ content: [{ type: 'text', text: 'Suggested. Calvin will accept, tweak or reject it.' }], isError: false });
    expect(calls).toEqual([['a', { threadId: 't1', find: 'incredible', replace: 'a lot', reason: 'Plainer.', mechanical: false }]]);
    expect(changed).toEqual(['a']);
  });

  it('passes on critique progress', async () => {
    const { rpc, calls } = setup();
    const res = await (await rpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'review_progress', arguments: { title: 'Line critique', done: 2, total: 7 } } })).json();
    expect(res.result.isError).toBe(false);
    expect(calls).toEqual([['a', { title: 'Line critique', done: 2, total: 7 }]]);
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

describe('share MCP tool', () => {
  function share(replaced = true, fail?: string) {
    const writes: unknown[] = [];
    const changed: string[] = [];
    const state = { schemaVersion: 1, networks: {} } as ShareState;
    const mcp = createShareMcpHandler({
      writeSocialPost: async (slug, w) => {
        writes.push([slug, w]);
        if (fail) throw new Error(fail);
        return { state, replaced };
      },
      changed: (slug) => changed.push(slug),
    });
    const rpc = async (body: object) => (await mcp('a', new Request('http://x/mcp-share/a', { method: 'POST', body: JSON.stringify(body) }))).json();
    const write = (a: object) => rpc({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'write_social_post', arguments: a } });
    return { rpc, write, writes, changed };
  }
  const text = (r: { result: { content: { text: string }[] } }) => r.result.content[0].text;

  it('lists only write_social_post, so share turns never see suggest_edit', async () => {
    const { rpc } = share();
    const list = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['write_social_post']);
    expect(SHARE_TOOL_NAMES).toEqual(['mcp__editor__write_social_post']);
  });

  it('saves the post, tells the page, and says where it went', async () => {
    const { write, writes, changed } = share();
    const res = await write({ network: 'linkedin', text: 'Hook.', hashtags: ['AI'], figure: 'preview', alt: 'Card.', claims_to_check: ['over a year'] });
    expect(text(res)).toBe('Saved; it shows in the text box.');
    expect(writes).toEqual([['a', { network: 'linkedin', text: 'Hook.', hashtags: ['AI'], figure: 'preview', alt: 'Card.', claims: ['over a year'] }]]);
    expect(changed).toEqual(['a']);
    expect(text(await share(false).write({ network: 'linkedin', text: 'Hook.', hashtags: [] }))).toMatch(/Versions menu/);
  });

  it('answers bad arguments and refusals as tool errors Claude can act on', async () => {
    const bad = await share().write({ network: 'linkedin', text: 'Hook.', hashtags: 'AI' });
    expect(bad.result.isError).toBe(true);
    const refused = await share(true, 'No figure "x".').write({ network: 'linkedin', text: 'Hook.', hashtags: [], figure: 'x' });
    expect(refused.result).toMatchObject({ isError: true, content: [{ text: 'No figure "x".' }] });
  });
});
