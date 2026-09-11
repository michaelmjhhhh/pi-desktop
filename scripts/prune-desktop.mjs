import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

// Only touch the staged copy, after Next has finished collecting dependencies.
// Keep declarations, Pi docs/assets and licenses for extensions.
export async function pruneDesktop(stage, platform, arch) {
  const saved = { tracing: 0, terminal: 0, sourceMaps: 0, nodeHeaders: 0 };
  async function files(directory, visit) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await files(path, visit);
      else if (entry.isFile()) await visit(path);
      // Never follow symlinks into another dependency or outside staging.
    }
  }
  async function removeTree(path, category = 'terminal') {
    await files(path, async (file) => { saved[category] += (await stat(file)).size; });
    await rm(path, { recursive: true });
  }
  const pty = join(stage, 'server/node_modules/node-pty');
  for (const entry of await readdir(join(pty, 'prebuilds'), { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name !== `${platform}-${arch}`) {
      await removeTree(join(pty, 'prebuilds', entry.name));
    }
  }
  // Windows may still need its ConPTY fallback; it cannot run on Unix.
  if (platform !== 'win32') await removeTree(join(pty, 'third_party'));
  // Official Windows ZIPs have no headers. Native installs can fetch/cache them
  // with node-gyp when needed instead of shipping the development SDK.
  if (platform !== 'win32') await removeTree(join(stage, 'runtime/include'), 'nodeHeaders');
  await files(join(stage, 'server/.next'), async (path) => {
    if (!path.endsWith('.nft.json')) return;
    saved.tracing += (await stat(path)).size;
    await rm(path);
  });
  for (const directory of ['server', 'runtime']) {
    await files(join(stage, directory), async (path) => {
      if (!/\.(?:[cm]?js|[cm]?ts)\.map$/.test(path)) return;
      const destination = join(stage, 'debug', relative(stage, path));
      await mkdir(dirname(destination), { recursive: true });
      saved.sourceMaps += (await stat(path)).size;
      await rename(path, destination);
    });
  }
  return saved;
}
