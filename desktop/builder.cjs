/* eslint-disable @typescript-eslint/no-require-imports */
const { access, readdir, realpath } = require('node:fs/promises');
const { join, relative, isAbsolute } = require('node:path');
module.exports = {
  appId: 'com.michael.pi-desktop',
  productName: 'Pi Desktop',
  directories: { output: 'dist' },
  files: ['desktop/main.cjs', 'desktop/server.cjs', 'package.json', 'LICENSE', 'NOTICE', '!node_modules{,/**/*}'],
  extraResources: [
    { from: '.desktop/server', to: 'server' },
    // electron-builder excludes a source root's node_modules unless mapped explicitly.
    { from: '.desktop/server/node_modules', to: 'server/node_modules' },
    { from: '.desktop/runtime', to: 'runtime' },
    { from: '.desktop/licenses', to: 'licenses' },
    { from: 'desktop/server.cjs', to: 'server.cjs' },
    { from: 'public/icons/app-icon.png', to: 'app-icon.png' },
    { from: 'LICENSE', to: 'LICENSE' },
    { from: 'NOTICE', to: 'NOTICE' },
  ],
  asar: true,
  npmRebuild: false,
  // Backend dependencies are already traced into extraResources/server.
  nodeGypRebuild: false,
  mac: { identity: process.env.CSC_NAME || '-', icon: 'public/icons/app-icon.png', target: ['zip', 'dmg'], category: 'public.app-category.developer-tools' },
  win: { icon: 'public/icons/app-icon.png', target: ['portable'] },
  linux: { icon: 'public/icons/app-icon.png', target: ['AppImage'], category: 'Development' },
  publish: null,
  afterPack: async (context) => {
    const resources = context.electronPlatformName === 'darwin'
      ? join(context.appOutDir, 'Pi Desktop.app', 'Contents', 'Resources')
      : join(context.appOutDir, 'resources');
    for (const file of ['server.cjs', 'LICENSE', 'NOTICE',
      'licenses/THIRD_PARTY_NOTICES.txt', 'licenses/LICENSES.chromium.html', 'licenses/NotoSansMono-OFL.txt', 'licenses/JetBrainsMono-OFL.txt',
      'server/node_modules/next/package.json', 'server/node_modules/node-pty/package.json',
      'server/node_modules/@earendil-works/pi-coding-agent/package.json',
      context.electronPlatformName === 'win32' ? 'runtime/node.exe' : 'runtime/bin/node',
      context.electronPlatformName === 'win32' ? 'runtime/node_modules/npm/bin/npx-cli.js' : 'runtime/bin/npx']) {
      await access(join(resources, file));
    }
    const resourceRoot = await realpath(resources);
    for (const entry of await readdir(resources, { recursive: true, withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue;
      const target = await realpath(join(entry.parentPath, entry.name));
      const pathFromResources = relative(resourceRoot, target);
      if (pathFromResources.startsWith('..') || isAbsolute(pathFromResources)) {
        throw new Error(`Packaged symlink escapes application resources: ${entry.name}`);
      }
    }
  },
};
