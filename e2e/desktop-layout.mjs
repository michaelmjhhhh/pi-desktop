import assert from 'node:assert/strict';

export async function checkDesktopLayout(application, page) {
  for (const zoom of [1, 1.25, 1.5]) {
    await application.evaluate(({ BrowserWindow }, factor) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setSize(900, 600);
      window.webContents.setZoomFactor(factor);
    }, zoom);
    await page.waitForFunction(factor => Math.abs(window.devicePixelRatio / factor - Math.round(window.devicePixelRatio / factor)) < 0.01, zoom);
    const theme = page.getByRole('button', { name: /^Theme:/ });
    await theme.click();
    const menu = page.getByRole('menu', { name: 'Appearance', exact: true });
    await menu.waitFor();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await menu.waitFor({ state: 'hidden' });
    assert.equal(await theme.evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('navigation', { name: 'Settings', exact: true }).getByRole('button', { name: 'General', exact: true }).click();
    const last = page.getByRole('switch', { name: 'Show actions for selected text', exact: true });
    await last.scrollIntoViewIfNeeded();
    assert.equal(await last.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true, `Last setting reachable at zoom ${zoom}`);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No page overflow at zoom ${zoom}`);
    const composer = page.locator('textarea').last();
    await composer.fill('Desktop layout draft');
  }
  await application.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.webContents.setZoomFactor(1);
    window.setSize(1440, 960);
  });
  await page.waitForFunction(() => innerWidth === 1440);
  for (const panel of ['sidebar', 'right-panel']) {
    if (panel === 'right-panel') await page.getByRole('button', { name: 'Show file panel', exact: true }).click();
    const handle = page.locator(`[data-resize-handle="${panel}"]`);
    await handle.waitFor({ state: 'visible' });
    const before = Number(await handle.getAttribute('aria-valuenow'));
    await handle.focus();
    await handle.press(panel === 'sidebar' ? 'ArrowRight' : 'ArrowLeft');
    assert.ok(Number(await handle.getAttribute('aria-valuenow')) > before, `${panel} keyboard resize`);
    const box = await handle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (panel === 'sidebar' ? 30 : -30), box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    assert.ok(Number(await handle.getAttribute('aria-valuenow')) > before, `${panel} pointer resize`);
  }
  await page.getByRole('button', { name: 'Hide file panel', exact: true }).first().click();
  assert.equal(await page.locator('textarea').last().inputValue(), 'Desktop layout draft', 'Window and panel changes preserve the current draft');
  return page.evaluate(() => ({ sidebarWidth: localStorage.getItem('pi-sidebar-width'), rightPanelWidth: localStorage.getItem('pi-right-panel-width') }));
}
