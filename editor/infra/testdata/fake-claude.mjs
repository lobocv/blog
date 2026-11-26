#!/usr/bin/env node
// Stands in for the claude CLI in tests: prints a recorded stream (FAKE_CLAUDE_STREAM), with
// FAKE_CLAUDE_DELAY ms between lines, and records its arguments to FAKE_CLAUDE_ARGS.
// When the file FAKE_CLAUDE_SUGGEST exists, it first calls suggest_edit with the {find, replace,
// reason} in it (on the thread named in the prompt) through the --mcp-config server, then deletes it.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const { FAKE_CLAUDE_STREAM, FAKE_CLAUDE_DELAY = '0', FAKE_CLAUDE_ARGS, FAKE_CLAUDE_FAIL_RESUME, FAKE_CLAUDE_SUGGEST } = process.env;
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
if (FAKE_CLAUDE_ARGS) writeFileSync(FAKE_CLAUDE_ARGS, `${JSON.stringify(process.argv.slice(2))}\n`, { flag: 'a' });
if (FAKE_CLAUDE_FAIL_RESUME && process.argv.includes('--resume')) {
  console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true }));
  process.exit(1);
}
process.on('SIGINT', () => process.exit(130));
if (FAKE_CLAUDE_SUGGEST && existsSync(FAKE_CLAUDE_SUGGEST) && process.argv.includes('--mcp-config')) {
  const suggestion = JSON.parse(readFileSync(FAKE_CLAUDE_SUGGEST, 'utf8'));
  rmSync(FAKE_CLAUDE_SUGGEST);
  const url = JSON.parse(arg('--mcp-config')).mcpServers.editor.url;
  const threadId = /thread (\S+) on/.exec(arg('-p'))?.[1];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'suggest_edit', arguments: { thread_id: threadId, ...suggestion } } }),
  });
  process.stderr.write(`suggest_edit: ${await res.text()}\n`);
}
for (const line of readFileSync(FAKE_CLAUDE_STREAM, 'utf8').split('\n').filter(Boolean)) {
  console.log(line);
  await new Promise((r) => setTimeout(r, Number(FAKE_CLAUDE_DELAY)));
}
