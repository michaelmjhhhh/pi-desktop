import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Include build dependencies too: browser bundles can contain packages that are
// not present in Next's server trace. Preserve their full published notices.
export async function collectLicenses(root, destination) {
  const records = new Map();
  async function visitModules(directory) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || !entry.isDirectory()) continue;
      const packageRoot = join(directory, entry.name);
      if (entry.name.startsWith('@')) { await visitModules(packageRoot); continue; }
      let pkg;
      try { pkg = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      const key = `${pkg.name}@${pkg.version}`;
      if (!records.has(key)) {
        const notices = [];
        const files = await readdir(packageRoot, { withFileTypes: true });
        for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
          if (!/^(licen[sc]e|copying|notice|copyright|authors)([.\-_]|$)/i.test(file.name)) continue;
          if (file.isFile()) notices.push(`${file.name}\n${await readFile(join(packageRoot, file.name), 'utf8')}`);
        }
        if (!notices.length) {
          const readme = files.find((file) => file.isFile() && /^readme([.]|$)/i.test(file.name));
          if (readme) notices.push(`${readme.name}\n${await readFile(join(packageRoot, readme.name), 'utf8')}`);
        }
        records.set(key, `${key}\nDeclared license: ${JSON.stringify(pkg.license ?? pkg.licenses ?? 'Not declared')}\n\n${notices.join('\n\n')}`);
      }
      await visitModules(join(packageRoot, 'node_modules'));
    }
  }
  await visitModules(join(root, 'node_modules'));
  await mkdir(destination, { recursive: true });
  await writeFile(join(destination, 'THIRD_PARTY_NOTICES.txt'),
    'Pi Desktop dependency notices\nIncludes installed runtime and build dependencies; not every listed package ships at runtime.\n\n'
    + [...records].sort(([a], [b]) => a.localeCompare(b)).map(([, text]) => text).join('\n\n' + '='.repeat(80) + '\n\n'));
  await cp(join(root, 'licenses/NotoSansMono-OFL.txt'), join(destination, 'NotoSansMono-OFL.txt'));
  // Resolving Electron also installs its platform distribution when necessary.
  createRequire(join(root, 'package.json'))('electron');
  await cp(join(root, 'node_modules/electron/dist/LICENSE'), join(destination, 'Electron-LICENSE.txt'));
  await cp(join(root, 'node_modules/electron/dist/LICENSES.chromium.html'), join(destination, 'LICENSES.chromium.html'));
  console.log(`Preserved notices for ${records.size} dependency versions, Electron/Chromium, and Noto Sans Mono.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await collectLicenses(resolve('.'), resolve('.desktop/licenses'));
}
