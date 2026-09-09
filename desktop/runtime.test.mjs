import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';

const stage = resolve('.desktop');
const node = process.platform === 'win32' ? join(stage, 'runtime/node.exe') : join(stage, 'runtime/bin/node');
test('bundled backend authenticates requests, discovers local sessions, runs a terminal, and shuts down', {
  skip: !existsSync(node) && 'Run npm run desktop:build first', timeout: 60000,
}, async () => {
  const home = await mkdtemp(join(tmpdir(), 'pi-desktop-test-'));
  const agentDir = join(home, 'agent');
  const project = join(home, 'project');
  await mkdir(project);
  const sessionDir = join(agentDir, 'sessions', '--desktop-test--');
  await mkdir(sessionDir, { recursive: true });
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const sessionFile = join(sessionDir, `${timestamp.replaceAll(':', '-')}_${id}.jsonl`);
  const token = randomBytes(32).toString('hex');
  let logs = '';
  const child = spawn(node, [resolve('desktop/server.cjs')], {
    env: { ...process.env, PI_DESKTOP_SERVER_ROOT: join(stage, 'server'), PI_DESKTOP_TOKEN: token,
      PI_CODING_AGENT_DIR: agentDir, PI_WEB_PASSWORD: '', NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production',
      SHELL: process.platform === 'win32' ? process.env.SHELL : '/bin/bash', HISTFILE: process.platform === 'win32' ? 'NUL' : '/dev/null' },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout.on('data', (data) => { logs += data; });
  child.stderr.on('data', (data) => { logs += data; });
  const exited = once(child, 'exit');
  try {
    const { port } = await new Promise((resolve, reject) => {
      child.once('message', resolve);
      child.once('error', reject);
      child.once('exit', () => reject(new Error(logs)));
    });
    const origin = `http://127.0.0.1:${port}`;
    const request = (path, options = {}) => fetch(origin + path, {
      ...options, headers: { 'x-pi-desktop-token': token, origin, 'content-type': 'application/json', ...options.headers },
    });
    assert.equal((await fetch(origin + '/api/sessions')).status, 403);
    assert.equal((await request('/api/sessions', { headers: { 'x-pi-desktop-token': 'invalid' } })).status, 403);
    assert.equal((await request('/api/sessions', { headers: { origin: 'https://example.com' } })).status, 403);
    assert.equal((await request('/')).status, 200, logs);
    const empty = await request('/api/sessions');
    assert.equal(empty.status, 200, await empty.clone().text());
    assert.deepEqual((await empty.json()).sessions, []);
    await writeFile(sessionFile, [
      { type: 'session', version: 3, id, timestamp, cwd: project },
      { type: 'message', id: 'test-msg', parentId: null, timestamp,
        message: { role: 'user', content: [{ type: 'text', text: 'Desktop discovery test' }], timestamp: Date.now() } },
    ].map((entry) => JSON.stringify(entry)).join('\n') + '\n');
    const found = await (await request('/api/sessions?force=1')).json();
    assert.ok(found.sessions.some((entry) => entry.id === id), JSON.stringify(found));
    const terminal = await request('/api/terminal', { method: 'POST', body: JSON.stringify({ cwd: project }) });
    assert.equal(terminal.status, 200, await terminal.clone().text());
    const terminalId = (await terminal.json()).id;
    const command = await request(`/api/terminal/${terminalId}`, {
      method: 'POST', body: JSON.stringify({ type: 'input', data: 'echo PI_DESKTOP_TERMINAL_OK\r' }),
    });
    assert.equal(command.status, 200);
    const stream = await request(`/api/terminal/${terminalId}/events`, { signal: AbortSignal.timeout(10000) });
    const reader = stream.body.getReader();
    let output = '';
    try {
      while (!output.includes('PI_DESKTOP_TERMINAL_OK')) {
        const { value, done } = await reader.read();
        if (done) break;
        output += new TextDecoder().decode(value);
      }
    } finally { await reader.cancel(); }
    assert.match(output, /PI_DESKTOP_TERMINAL_OK/);
    await request(`/api/terminal/${terminalId}`, { method: 'DELETE' });
    child.send('shutdown');
    const [code] = await exited;
    assert.equal(code, 0, logs);
    await assert.rejects(fetch(origin));
  } finally {
    if (child.exitCode === null) { child.kill('SIGKILL'); await exited; }
    await rm(home, { recursive: true, force: true });
  }
});
