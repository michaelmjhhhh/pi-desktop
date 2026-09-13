/* eslint-disable @typescript-eslint/no-require-imports */
const { BrowserWindow, dialog, net, session, shell } = require('electron');

function openExternal(url) {
  try {
    if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) void shell.openExternal(url);
  } catch { /* Ignore invalid links. */ }
}

// Exported conversations contain HTML and scripts. Give them an isolated,
// offline session, never the application's authenticated backend or storage.
async function openHistory(url, parent) {
  const response = await net.fetch(url);
  if (!response.ok) throw new Error(`Unable to export history (HTTP ${response.status})`);
  const html = await response.text();
  if (parent.isDestroyed()) return;
  const isolated = session.fromPartition('session-history');
  isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  isolated.setPermissionCheckHandler(() => false);
  isolated.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'file://*/*'] }, (_details, callback) => callback({ cancel: true }));
  const history = new BrowserWindow({
    width: 1100, height: 800, parent, title: 'Session history',
    webPreferences: { session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  history.webContents.setWindowOpenHandler(({ url: target }) => { openExternal(target); return { action: 'deny' }; });
  history.webContents.on('will-navigate', (event) => { event.preventDefault(); openExternal(event.url); });
  history.webContents.on('will-attach-webview', (event) => event.preventDefault());
  const closeHistory = () => { if (!history.isDestroyed()) history.close(); };
  parent.once('closed', closeHistory);
  history.once('closed', () => parent.removeListener('closed', closeHistory));
  await history.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function configureNavigation(window, origin) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    const target = new URL(url);
    if (target.origin === origin) {
      if (/^\/api\/sessions\/[^/]+\/export$/.test(target.pathname)) {
        void openHistory(url, window).catch((error) => dialog.showErrorBox('Unable to open history', String(error)));
      }
    } else {
      openExternal(url);
    }
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => {
    if (new URL(event.url).origin !== origin) { event.preventDefault(); openExternal(event.url); }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

module.exports = { configureNavigation, openExternal };
