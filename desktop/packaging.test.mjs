import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { pruneDesktop } from '../scripts/prune-desktop.mjs';

for (const platform of ['darwin', 'win32']) {
  test(`staging cleanup preserves ${platform} runtime assets and archives maps`, async () => {
    const stage = await mkdtemp(join(tmpdir(), 'pi-packaging-'));
    const pty = 'server/node_modules/node-pty';
    const retained = ['runtime/lib/npm.js',
      'server/.next/required-server-files.json', 'server/.next/server/app/route.js',
      'server/node_modules/pi/dist/index.d.ts', 'server/node_modules/pi/docs/extensions.md',
      'server/node_modules/pi/LICENSE', 'server/public/data.map',
      `${pty}/prebuilds/${platform}-arm64/pty.node`, `${pty}/build/Release/spawn-helper`];
    const removed = ['server/.next/server/app/route.js.nft.json',
      `${pty}/prebuilds/linux-x64/pty.node`];
    const maps = ['server/node_modules/pi/dist/index.js.map', 'runtime/lib/npm.js.map'];
    const conpty = `${pty}/third_party/conpty/OpenConsole.exe`;
    const header = 'runtime/include/node/node.h';
    try {
      for (const path of [...retained, ...removed, ...maps, conpty]) {
        await mkdir(dirname(join(stage, path)), { recursive: true });
        await writeFile(join(stage, path), path);
      }
      if (platform !== 'win32') {
        await mkdir(dirname(join(stage, header)), { recursive: true });
        await writeFile(join(stage, header), header);
      }
      if (process.platform !== 'win32') await symlink(join(stage, 'runtime'), join(stage, 'server/linked-runtime'));
      const saved = await pruneDesktop(stage, platform, 'arm64');
      for (const path of retained) assert.equal(await readFile(join(stage, path), 'utf8'), path);
      for (const path of [...removed, ...maps]) await assert.rejects(readFile(join(stage, path)), { code: 'ENOENT' });
      for (const path of maps) assert.equal(await readFile(join(stage, 'debug', path), 'utf8'), path);
      if (platform === 'win32') assert.equal(await readFile(join(stage, conpty), 'utf8'), conpty);
      else await assert.rejects(readFile(join(stage, conpty)), { code: 'ENOENT' });
      assert.equal(saved.tracing, Buffer.byteLength(removed[0]));
      assert.equal(saved.sourceMaps, maps.reduce((sum, path) => sum + Buffer.byteLength(path), 0));
      assert.equal(saved.terminal, Buffer.byteLength(removed[1]) + (platform === 'win32' ? 0 : Buffer.byteLength(conpty)));
      await assert.rejects(readFile(join(stage, header)), { code: 'ENOENT' });
      assert.equal(saved.nodeHeaders, platform === 'win32' ? 0 : Buffer.byteLength(header));
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  });
}

test('packaged macOS app omits Node headers and retains only Chinese/English locales', {
  skip: process.platform !== 'darwin' || !process.env.PI_DESKTOP_RESOURCES,
}, async () => {
  const resources = process.env.PI_DESKTOP_RESOURCES;
  await assert.rejects(access(join(resources, 'runtime/include')), { code: 'ENOENT' });
  const frameworkResources = join(resources, '../Frameworks/Electron Framework.framework/Versions/A/Resources');
  for (const directory of [resources, frameworkResources]) {
    const locales = (await readdir(directory)).filter(name => name.endsWith('.lproj'));
    for (const locale of ['en.lproj', 'en_GB.lproj', 'zh_CN.lproj', 'zh_TW.lproj']) {
      assert.ok(locales.includes(locale), `${directory}: missing ${locale}`);
    }
    assert.ok(locales.every(name => /^(en(?:_GB)?|zh_CN|zh_TW)(?:_(?:FEMININE|MASCULINE|NEUTER))?\.lproj$/.test(name)), locales.join(', '));
  }
});
