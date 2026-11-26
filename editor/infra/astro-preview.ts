// Runs `astro dev` for the preview view, with EDITOR_PREVIEW=1 so pages carry source lines
// and the editor bridge (see astro.config.mjs).
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { join } from 'node:path';
import type { Preview } from '../app/ports.ts';

export class AstroPreview implements Preview {
  readonly #root: string;
  readonly #port: number;
  #started: Promise<string>;
  #failed = false;
  #child: ChildProcess | undefined;

  /** Starts Astro straight away, so it's usually ready by the time Calvin swaps to the preview. */
  constructor(root: string, port: number) {
    this.#root = root;
    this.#port = port;
    this.#started = this.#begin();
  }

  /** After a failed start (eg a post's front matter was broken), asking again starts Astro again. */
  origin() {
    if (this.#failed) this.#started = this.#begin();
    return this.#started;
  }

  #begin() {
    this.#failed = false;
    const started = this.#start(this.#root, this.#port);
    // Callers may never ask, and an unhandled rejection would end the process.
    started.catch(() => (this.#failed = true));
    return started;
  }

  watchFigures(onChange: () => void) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // An editor saves a file in a few steps; tell once.
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 100);
    };
    const watchers = ['src/components', 'src/styles']
      .map((dir) => join(this.#root, dir))
      .filter((dir) => existsSync(dir))
      .map((dir) => watch(dir, { recursive: true }, changed).on('error', () => {}));
    return () => {
      clearTimeout(timer);
      for (const w of watchers) w.close();
    };
  }

  stop() {
    this.#child?.kill();
  }

  async #start(root: string, port: number): Promise<string> {
    const origin = `http://127.0.0.1:${port}`;
    // --ignore-lock: runs beside `make dev` instead of refusing to start.
    const args = [join(root, 'node_modules/astro/bin/astro.mjs'), 'dev', '--ignore-lock', '--host', '127.0.0.1', '--port', String(port)];
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, EDITOR_PREVIEW: '1' }, stdio: 'pipe' });
    this.#child = child;

    let output = '';
    const keep = (d: Buffer) => (output = (output + d).slice(-4000));
    child.stdout?.on('data', keep);
    child.stderr?.on('data', keep);

    let exited = false;
    child.on('exit', () => (exited = true));
    child.on('error', (err) => ((exited = true), keep(Buffer.from(String(err)))));

    for (let tries = 0; tries < 240; tries++) {
      if (exited) throw new Error(`astro dev stopped:\n${output.trim()}`);
      try {
        await fetch(origin, { signal: AbortSignal.timeout(1000) });
        return origin;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error(`astro dev didn't answer on ${origin} within a minute:\n${output.trim()}`);
  }
}
