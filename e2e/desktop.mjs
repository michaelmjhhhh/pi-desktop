import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { extensionSource } from './extension-dialog.mjs';
import { checkDesktopLayout } from './desktop-layout.mjs';
import { checkDesktopShell, checkDesktopAttention } from './desktop-shell.mjs';

const fixture = await mkdtemp(join(tmpdir(), 'pi-desktop-ui-'));
const agentDir = join(fixture, 'agent');
const project = join(fixture, 'Desktop test project');
const sessions = join(agentDir, 'sessions', '--desktop-test--');
await mkdir(project);
await mkdir(join(agentDir, 'extensions'), { recursive: true });
await writeFile(join(agentDir, 'extensions/desktop-dialog.js'), extensionSource);
await mkdir(sessions, { recursive: true });
const id = randomUUID();
const timestamp = new Date().toISOString();
await writeFile(join(sessions, `${id}.jsonl`), [
  { type: 'session', version: 3, id, timestamp, cwd: project },
  { type: 'message', id: 'msg1', parentId: null, timestamp, message: { role: 'user', content: [{ type: 'text', text: 'Desktop smoke test conversation' }], timestamp: Date.now() } },
].map((entry) => JSON.stringify(entry)).join('\n') + '\n');
const executablePath = process.env.PI_DESKTOP_EXECUTABLE;
const launchOptions = {
  ...(executablePath ? { executablePath, args: [] } : { args: [resolve('.')] }),
  env: { ...process.env, PI_CODING_AGENT_DIR: agentDir, PI_DESKTOP_USER_DATA_DIR: join(fixture, 'profile') },
};
delete launchOptions.env.ELECTRON_RUN_AS_NODE;
let application;
try {
  application = await electron.launch(launchOptions);
  const page = await application.firstWindow({ timeout: 30000 });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForURL('http://pi-desktop.localhost/');
  await page.evaluate(() => localStorage.setItem('pi-locale', 'en'));
  await page.reload();
  await page.getByText('Desktop smoke test conversation', { exact: false }).first().waitFor({ timeout: 30000 });
  const api = await page.evaluate(async (cwd) => {
    const sessions = await fetch('/api/sessions').then((response) => response.json());
    const models = await fetch('/api/models?cwd=' + encodeURIComponent(cwd)).then((response) => response.status);
    localStorage.setItem('desktop-persistence-test', 'saved');
    return { sessions, models, nodeAccess: typeof window.require, workers: (await navigator.serviceWorker.getRegistrations()).length };
  }, project);
  assert.ok(api.sessions.sessions.some((entry) => entry.id === id));
  assert.equal(api.models, 200);
  assert.equal(api.nodeAccess, 'undefined');
  assert.equal(api.workers, 0);
  const preferences = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(preferences.sandbox, true);
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  // Verify streamed API responses and POST forwarding through the private origin.
  const terminal = await page.evaluate(async (cwd) => {
    const response = await fetch('/api/terminal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cwd }) });
    const data = await response.json();
    if (response.ok) {
      await fetch(`/api/terminal/${data.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'input', data: 'echo PI_DESKTOP_STREAM_OK\r' }) });
      const stream = await fetch(`/api/terminal/${data.id}/events`, { signal: AbortSignal.timeout(10000) });
      const reader = stream.body.getReader();
      let output = '';
      try {
        while (!output.includes('PI_DESKTOP_STREAM_OK')) {
          const { value, done } = await reader.read();
          if (done) break;
          output += new TextDecoder().decode(value);
        }
      } finally { await reader.cancel(); }
      if (!output.includes('PI_DESKTOP_STREAM_OK')) throw new Error('Terminal stream did not deliver output');
      await fetch(`/api/terminal/${data.id}`, { method: 'DELETE' });
    }
    return { status: response.status, data };
  }, project);
  assert.equal(terminal.status, 200, JSON.stringify(terminal));
  const addedId = randomUUID();
  await writeFile(join(sessions, `${addedId}.jsonl`), [
    { type: 'session', version: 3, id: addedId, timestamp, cwd: project },
    { type: 'message', id: 'msg2', parentId: null, timestamp, message: { role: 'user', content: [{ type: 'text', text: 'New CLI session discovered automatically' }], timestamp: Date.now() } },
  ].map((entry) => JSON.stringify(entry)).join('\n') + '\n');
  await page.getByText('New CLI session discovered automatically', { exact: false }).first().waitFor({ timeout: 50000 });
  await page.getByText('Desktop smoke test conversation', { exact: false }).first().click();
  await page.waitForFunction(() => document.querySelectorAll('textarea').length > 0);
  await checkDesktopShell(application, page);
  await checkDesktopAttention(page);
  const layout = await checkDesktopLayout(application, page);
  assert.deepEqual(errors, []);
  await application.close();
  application = await electron.launch(launchOptions);
  const reopened = await application.firstWindow({ timeout: 30000 });
  await reopened.waitForURL(url => url.origin === 'http://pi-desktop.localhost');
  await reopened.waitForLoadState('domcontentloaded');
  assert.equal(await reopened.evaluate(() => localStorage.getItem('desktop-persistence-test')), 'saved');
  await reopened.locator('textarea').last().waitFor();
  assert.equal(await reopened.evaluate(() => localStorage.getItem('pi-theme')), 'dark');
  assert.deepEqual(await reopened.evaluate(() => ({ sidebarWidth: localStorage.getItem('pi-sidebar-width'), rightPanelWidth: localStorage.getItem('pi-right-panel-width') })), layout);
  assert.ok(reopened.url().includes(id), 'Selected session survives restart');
  console.log('PASS: Electron UI, automatic session discovery, model API, native terminal, history isolation, external links, clipboard, notifications, minimum window/zoom, panel resizing, persistent settings, relaunch.');
} catch (error) {
  const artifacts = resolve('test-results/desktop');
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, 'error.txt'), String(error.stack || error));
  await cp(join(fixture, 'profile/logs'), join(artifacts, 'logs'), { recursive: true }).catch(() => {});
  for (const [index, page] of (application?.windows() || []).entries()) {
    await page.screenshot({ path: join(artifacts, `window-${index}.png`) }).catch(() => {});
  }
  throw error;
} finally {
  if (application) await application.close();
  await rm(fixture, { recursive: true, force: true });
}
