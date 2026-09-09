/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, Menu, session, shell, net } = require('electron');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { appendFileSync, mkdirSync } = require('node:fs');
const { join, delimiter } = require('node:path');
const { homedir } = require('node:os');
app.setName('Pi Desktop');
if (process.env.PI_DESKTOP_USER_DATA_DIR) app.setPath('userData', process.env.PI_DESKTOP_USER_DATA_DIR);
let backend;
let window;
let origin;
let quitting = false;
let stopped = false;
const development = !app.isPackaged && process.argv.includes('--dev');
const token = randomBytes(32).toString('hex');
const iconPath = app.isPackaged ? join(process.resourcesPath, 'app-icon.png') : join(__dirname, '..', 'public', 'icons', 'app-icon.png');

async function startBackend() {
  if (development) return 'http://127.0.0.1:30141';
  const resources = app.isPackaged ? process.resourcesPath : join(__dirname, '..', '.desktop');
  const runtime = join(resources, 'runtime');
  const node = process.platform === 'win32' ? join(runtime, 'node.exe') : join(runtime, 'bin', 'node');
  const root = join(resources, 'server');
  const env = {
    ...process.env,
    NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
    PI_DESKTOP_TOKEN: token, PI_DESKTOP_SERVER_ROOT: root,
    PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR || join(homedir(), '.pi', 'agent'),
    PI_WEB_PASSWORD: '', PI_WEB_ALLOWED_HOSTS: '', PI_WEB_HOSTNAME: '127.0.0.1',
    PATH: [process.platform === 'win32' ? runtime : join(runtime, 'bin'),
      join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', process.env.PATH || ''].join(delimiter),
  };
  delete env.NODE_OPTIONS;
  delete env.ELECTRON_RUN_AS_NODE;
  mkdirSync(app.getPath('logs'), { recursive: true });
  const log = join(app.getPath('logs'), 'backend.log');
  const launcher = app.isPackaged ? join(resources, 'server.cjs') : join(__dirname, 'server.cjs');
  backend = spawn(node, [launcher], {
    cwd: homedir(), env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
  });
  for (const stream of [backend.stdout, backend.stderr]) {
    stream.on('data', (data) => appendFileSync(log, data));
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Backend startup timed out. See ${log}`)), 60000);
    backend.once('error', (error) => { clearTimeout(timeout); stopped = true; reject(error); });
    backend.once('exit', (code) => {
      clearTimeout(timeout);
      stopped = true;
      reject(new Error(`Backend exited (${code}). See ${log}`));
      if (origin && !quitting) {
        dialog.showErrorBox('Pi Desktop stopped', `The local backend exited. Restart Pi Desktop.\nLogs: ${log}`);
        app.quit();
      }
    });
    backend.once('message', (message) => {
      if (!Number.isInteger(message.port) || message.port < 1 || message.port > 65535) return;
      clearTimeout(timeout);
      resolve(`http://127.0.0.1:${message.port}`);
    });
  });
}
function openExternal(url) {
  try {
    if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url);
  } catch { /* Ignore invalid links. */ }
}
async function createWindow() {
  window = new BrowserWindow({
    width: 1440, height: 960, minWidth: 900, minHeight: 600,
    icon: iconPath,
    title: 'Pi Desktop', show: false, backgroundColor: '#1a1a1a',
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); openExternal(url); }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = null; });
  await window.loadURL(origin);
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(async () => {
    app.dock?.setIcon(iconPath);
    app.setAboutPanelOptions({
      applicationName: 'Pi Desktop', applicationVersion: app.getVersion(),
      copyright: 'Based on Pi Web. Copyright © 2026 agegr. MIT License.',
      credits: 'Original project: https://github.com/agegr/pi-web',
    });
    const backendOrigin = await startBackend();
    // A stable renderer origin preserves settings across random backend ports.
    origin = development ? backendOrigin : 'http://pi-desktop.localhost';
    if (!development) {
      session.defaultSession.protocol.handle('http', async (request) => {
        const url = new URL(request.url);
        if (url.origin !== origin) return new Response('Forbidden', { status: 403 });
        const headers = new Headers(request.headers);
        if (headers.has('origin') && headers.get('origin') !== origin) {
          return new Response('Forbidden', { status: 403 });
        }
        if (headers.has('origin')) headers.set('origin', backendOrigin);
        headers.delete('host');
        headers.set('x-pi-desktop-token', token);
        return net.fetch(backendOrigin + url.pathname + url.search, {
          method: request.method, headers, body: request.body, duplex: 'half',
          bypassCustomProtocolHandlers: true, redirect: 'manual',
        });
      });
    }
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
      callback(contents === window?.webContents && new URL(contents.getURL()).origin === origin
        && ['notifications', 'clipboard-sanitized-write'].includes(permission));
    });
    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
      contents === window?.webContents && requestingOrigin === origin && ['notifications', 'clipboard-sanitized-write'].includes(permission));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Pi Desktop', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
      { label: 'Help', submenu: [
        { label: 'Original Pi Web (MIT)', click: () => openExternal('https://github.com/agegr/pi-web') },
        { label: 'Open logs', click: () => { void shell.openPath(app.getPath('logs')); } },
      ] },
    ]));
    await createWindow();
    app.on('activate', () => { if (!window) void createWindow(); });
  }).catch((error) => { dialog.showErrorBox('Unable to start Pi Desktop', String(error)); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    quitting = true;
    if (!backend || stopped) return;
    event.preventDefault();
    if (backend.connected) backend.send('shutdown');
    const deadline = setTimeout(() => { backend.kill('SIGKILL'); }, 6000);
    backend.once('exit', () => { clearTimeout(deadline); stopped = true; app.quit(); });
  });
}
