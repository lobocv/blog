#!/usr/bin/env node
// Stands in for the claude CLI in tests: prints a recorded stream (FAKE_CLAUDE_STREAM), with
// FAKE_CLAUDE_DELAY ms between lines, and records its arguments to FAKE_CLAUDE_ARGS.
// When the file FAKE_CLAUDE_TOOLS exists, it first makes the tool calls listed in it
// ([{ name, arguments }], with "$thread" standing for the thread named in the prompt) through the
// --mcp-config server, then deletes the file.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const { FAKE_CLAUDE_STREAM, FAKE_CLAUDE_DELAY = '0', FAKE_CLAUDE_ARGS, FAKE_CLAUDE_FAIL_RESUME, FAKE_CLAUDE_TOOLS } = process.env;
const arg = (name) => process.argv[process.argv.indexOf(name) + 1];
if (FAKE_CLAUDE_ARGS) writeFileSync(FAKE_CLAUDE_ARGS, `${JSON.stringify(process.argv.slice(2))}\n`, { flag: 'a' });
if (FAKE_CLAUDE_FAIL_RESUME && process.argv.includes('--resume')) {
  console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true }));
  process.exit(1);
}
process.on('SIGINT', () => process.exit(130));
if (FAKE_CLAUDE_TOOLS && existsSync(FAKE_CLAUDE_TOOLS) && process.argv.includes('--mcp-config')) {
  const calls = JSON.parse(readFileSync(FAKE_CLAUDE_TOOLS, 'utf8'));
  rmSync(FAKE_CLAUDE_TOOLS);
  const url = JSON.parse(arg('--mcp-config')).mcpServers.editor.url;
  const prompt = arg('-p');
  const thread = prompt.startsWith('Calvin wrote in the page thread') ? 'page' : /thread (\S+) on/.exec(prompt)?.[1];
  for (const [i, { name, arguments: args }] of calls.entries()) {
    const filled = Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v === '$thread' ? thread : v]));
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name, arguments: filled } }),
    });
    process.stderr.write(`${name}: ${await res.text()}\n`);
  }
}
for (const line of readFileSync(FAKE_CLAUDE_STREAM, 'utf8').split('\n').filter(Boolean)) {
  console.log(line);
  await new Promise((r) => setTimeout(r, Number(FAKE_CLAUDE_DELAY)));
}
