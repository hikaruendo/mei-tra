#!/usr/bin/env node
const { execFileSync, spawn } = require('child_process');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const nestBin = path.join(backendRoot, 'node_modules', '.bin', 'nest');
const extraArgs = process.argv.slice(2);
const targetMarkers = [
  `${path.join(backendRoot, 'node_modules', '.bin', 'nest')} start --watch`,
  `${path.join(backendRoot, 'dist', 'main')}`,
];

function readProcesses() {
  const output = execFileSync('ps', ['-ax', '-o', 'pid=,ppid=,command='], {
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.*)$/);
      if (!match) {
        return null;
      }

      return {
        pid: Number(match[1]),
        ppid: Number(match[2]),
        command: match[3],
      };
    })
    .filter(Boolean);
}

function collectOwnedPids(processes) {
  const candidates = new Set();

  for (const proc of processes) {
    if (proc.pid === process.pid) {
      continue;
    }

    if (targetMarkers.some((marker) => proc.command.includes(marker))) {
      candidates.add(proc.pid);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const proc of processes) {
      if (proc.pid === process.pid || candidates.has(proc.pid)) {
        continue;
      }

      if (candidates.has(proc.ppid)) {
        candidates.add(proc.pid);
        changed = true;
      }
    }
  }

  return [...candidates].sort((a, b) => b - a);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopExistingWatchers() {
  const processes = readProcesses();
  const ownedPids = collectOwnedPids(processes);
  if (ownedPids.length === 0) {
    return;
  }

  for (const pid of ownedPids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {}
  }

  for (let i = 0; i < 10; i += 1) {
    if (ownedPids.every((pid) => !isAlive(pid))) {
      return;
    }
    await sleep(200);
  }

  for (const pid of ownedPids) {
    if (!isAlive(pid)) {
      continue;
    }
    try {
      process.kill(pid, 'SIGKILL');
    } catch {}
  }
}

async function main() {
  await stopExistingWatchers();

  const child = spawn(nestBin, ['start', '--watch', '--webpack', ...extraArgs], {
    cwd: backendRoot,
    stdio: 'inherit',
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
