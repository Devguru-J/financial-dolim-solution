#!/usr/bin/env bun
/**
 * Single-command local dev launcher.
 * Starts both the Hono API server and the Vite dev server,
 * streams their output with color-coded prefixes,
 * and kills both on Ctrl-C.
 *
 * Usage:  bun scripts/dev.ts
 *    or:  bun run dev:all
 */

const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function prefix(tag: string, color: string) {
  return `${color}[${tag}]${RESET} `;
}

function pipeOutput(stream: ReadableStream<Uint8Array> | null, tag: string, color: string) {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const pfx = prefix(tag, color);
  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line) process.stdout.write(`${pfx}${line}\n`);
      }
    }
  })();
}

console.log(`${DIM}Starting backend + frontend...${RESET}\n`);

const backend = Bun.spawn(["bun", "--env-file=.dev.vars", "src/local-dev.ts"], {
  cwd: import.meta.dir + "/..",
  stdout: "pipe",
  stderr: "pipe",
});

const frontend = Bun.spawn(["bun", "run", "dev"], {
  cwd: import.meta.dir + "/../client",
  stdout: "pipe",
  stderr: "pipe",
});

pipeOutput(backend.stdout, "API ", CYAN);
pipeOutput(backend.stderr, "API ", CYAN);
pipeOutput(frontend.stdout, "VITE", MAGENTA);
pipeOutput(frontend.stderr, "VITE", MAGENTA);

function cleanup() {
  console.log(`\n${DIM}Shutting down...${RESET}`);
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Keep alive until either process exits
await Promise.race([backend.exited, frontend.exited]);
cleanup();
