import { type ChildProcess, spawn } from 'node:child_process';

/** Starts `editor/main.ts` on `port` and resolves once it prints its URL. */
export async function startEditor(root: string, port: number, ...args: string[]): Promise<ChildProcess> {
  const editor = spawn('node', ['editor/main.ts', '--root', root, '--port', String(port), ...args], { stdio: 'pipe' });
  const url = `http://127.0.0.1:${port}/`;
  await new Promise<void>((ready, fail) => {
    editor.stdout!.on('data', (d) => String(d).includes(url) && ready());
    editor.on('exit', (code) => fail(new Error(`editor exited with ${code}`)));
  });
  return editor;
}
