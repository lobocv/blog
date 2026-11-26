#!/usr/bin/env node
// Stands in for the claude CLI in tests: prints a recorded stream (FAKE_CLAUDE_STREAM), with
// FAKE_CLAUDE_DELAY ms between lines, and records its arguments to FAKE_CLAUDE_ARGS.
import { readFileSync, writeFileSync } from 'node:fs';

const { FAKE_CLAUDE_STREAM, FAKE_CLAUDE_DELAY = '0', FAKE_CLAUDE_ARGS, FAKE_CLAUDE_FAIL_RESUME } = process.env;
if (FAKE_CLAUDE_ARGS) writeFileSync(FAKE_CLAUDE_ARGS, `${JSON.stringify(process.argv.slice(2))}\n`, { flag: 'a' });
if (FAKE_CLAUDE_FAIL_RESUME && process.argv.includes('--resume')) {
  console.log(JSON.stringify({ type: 'result', subtype: 'error_during_execution', is_error: true }));
  process.exit(1);
}
process.on('SIGINT', () => process.exit(130));
for (const line of readFileSync(FAKE_CLAUDE_STREAM, 'utf8').split('\n').filter(Boolean)) {
  console.log(line);
  await new Promise((r) => setTimeout(r, Number(FAKE_CLAUDE_DELAY)));
}
