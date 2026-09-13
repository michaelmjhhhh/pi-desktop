import assert from 'node:assert/strict';

export async function checkDesktopShell(application, page) {
  // Capture the OS boundary without opening a real browser during CI.
  await application.evaluate(({ shell }) => {
    globalThis.externalUrls = [];
    globalThis.originalOpenExternal = shell.openExternal;
    shell.openExternal = async (url) => { globalThis.externalUrls.push(url); };
  });
  try {
    await page.evaluate(() => window.open('https://example.com/desktop-regression', '_blank'));
    await page.waitForFunction(() => document.readyState === 'complete');
    const deadline = Date.now() + 5000;
    while (!(await application.evaluate(() => globalThis.externalUrls.length))) {
      assert.ok(Date.now() < deadline, 'External link was not handed to the OS');
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.deepEqual(await application.evaluate(() => globalThis.externalUrls), ['https://example.com/desktop-regression']);
    assert.equal(application.windows().length, 1);

    await page.locator('.workspace-tools-toggle').click();
    const [history] = await Promise.all([
      application.waitForEvent('window'),
      page.getByRole('button', { name: /^Full history$/i }).click(),
    ]);
    await history.waitForLoadState('domcontentloaded');
    await history.getByText('Desktop smoke test conversation', { exact: false }).first().waitFor();
    assert.ok(history.url().startsWith('data:text/html'));
    const isolation = await history.evaluate(async () => ({
      node: typeof window.require,
      origin: location.origin,
      backend: await fetch('http://pi-desktop.localhost/api/sessions').then(() => true, () => false),
    }));
    assert.deepEqual(isolation, { node: 'undefined', origin: 'null', backend: false });
    await history.close();
    assert.equal(application.windows().length, 1);
    assert.deepEqual(await application.evaluate(() => globalThis.externalUrls), ['https://example.com/desktop-regression']);
  } finally {
    await application.evaluate(({ shell }) => { shell.openExternal = globalThis.originalOpenExternal; });
  }

  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].focus());
  await page.waitForFunction(() => document.hasFocus());
  // Restore every clipboard format, not just the text used by this probe.
  await application.evaluate(async ({ clipboard, ClipboardItem }) => {
    const items = await clipboard.read();
    // Resolve lazy clipboard data before replacing the system contents.
    globalThis.savedClipboard = await Promise.all(items.filter(item => item.types.length).map(async item => new ClipboardItem(
      Object.fromEntries(await Promise.all(item.types.map(async type => [type, await item.getType(type)]))),
    )));
  });
  try {
    await page.getByText('Desktop smoke test conversation', { exact: true }).last().hover();
    const copy = page.getByTitle('Copy message', { exact: true }).first();
    await copy.focus();
    await copy.press('Enter');
    await page.getByTitle('Copy message', { exact: true }).first().getByText('Copied', { exact: true }).waitFor();
    assert.equal(await application.evaluate(({ clipboard }) => clipboard.readText()), 'Desktop smoke test conversation');
    const composer = page.locator('textarea').last();
    const draft = await composer.inputValue();
    await composer.fill('');
    await composer.press(process.platform === 'darwin' ? 'Meta+V' : 'Control+V');
    await page.waitForFunction(() => document.querySelector('textarea')?.value === 'Desktop smoke test conversation');
    await composer.fill(draft);
  } finally {
    await application.evaluate(async ({ clipboard }) => {
      if (globalThis.savedClipboard.length) await clipboard.write(globalThis.savedClipboard);
      else clipboard.clear();
      delete globalThis.savedClipboard;
    });
  }
  const permission = await page.evaluate(() => Notification.requestPermission());
  assert.equal(permission, 'granted');
  // OS banner display depends on system settings; verify permission and creation.
  await page.evaluate(() => { const notification = new Notification('Pi Desktop regression', { silent: true }); notification.close(); });
}

export async function checkDesktopAttention(page) {
  await page.evaluate(() => {
    window.savedNotification = window.Notification;
    window.savedHasFocus = document.hasFocus;
    document.hasFocus = () => false;
    window.desktopNotifications = [];
    window.Notification = class {
      static permission = 'granted';
      constructor(title, options) { this.title = title; this.options = options; window.desktopNotifications.push(this); }
      close() { this.closed = true; }
    };
  });
  try {
    await page.locator('textarea').last().fill('/e2e-dialog confirm');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'E2E confirm', exact: true });
    await dialog.waitFor();
    await page.waitForFunction(() => window.desktopNotifications.some(n => n.options.body === 'E2E confirm'));
    const before = page.url();
    await page.getByText('New CLI session discovered automatically', { exact: false }).first().click();
    await page.waitForURL(url => url.href !== before);
    await page.evaluate(() => window.desktopNotifications.find(n => n.options.body === 'E2E confirm').onclick());
    await page.waitForURL(before);
    await dialog.waitFor();
    assert.equal(page.url(), before, 'Notification click selects the originating session');
    assert.equal(await page.evaluate(() => window.desktopNotifications.find(n => n.options.body === 'E2E confirm').closed), true);
    await dialog.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.getByText('E2E confirm result: true', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.desktopNotifications.filter(n => n.options.body === 'E2E confirm').length), 1);
  } finally {
    await page.evaluate(() => { window.Notification = window.savedNotification; document.hasFocus = window.savedHasFocus; });
  }
}
