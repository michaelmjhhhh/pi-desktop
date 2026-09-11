import { collectLicenses } from './collect-licenses.mjs';
import { pruneDesktop } from './prune-desktop.mjs';
import { cp, mkdir, readFile, rm, writeFile, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stage = join(root, '.desktop');
const nodeVersion = '22.22.2';
if (process.versions.node !== nodeVersion) throw new Error(`Build with Node ${nodeVersion} so native modules match the bundled runtime`);
const platform = process.platform;
const arch = process.arch;
if (!['darwin', 'linux', 'win32'].includes(platform) || !['arm64', 'x64'].includes(arch)) {
  throw new Error(`Unsupported desktop target: ${platform}-${arch}`);
}
function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
// A separate output directory keeps a running development server intact.
await run(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], {
  ...process.env, PI_DESKTOP_BUILD: '1', NEXT_TELEMETRY_DISABLED: '1',
});
const server = join(stage, 'server');
await cp(join(root, '.next-desktop/standalone'), server, { recursive: true, verbatimSymlinks: true });
// Normalize the production output name so the runtime does not need build flags.
await cp(join(server, '.next-desktop'), join(server, '.next'), { recursive: true });
await rm(join(server, '.next-desktop'), { recursive: true, force: true });
const requiredPath = join(server, '.next/required-server-files.json');
const required = JSON.parse(await readFile(requiredPath, 'utf8'));
required.config.distDir = '.next';
await writeFile(requiredPath, JSON.stringify(required));
await cp(join(root, '.next-desktop/static'), join(server, '.next/static'), { recursive: true });
await cp(join(root, 'public'), join(server, 'public'), { recursive: true });
await cp(join(root, 'LICENSE'), join(server, 'LICENSE'));

// Official Node distribution includes npm/npx for Pi package and skill management.
const base = `node-v${nodeVersion}-${platform === 'win32' ? 'win' : platform}-${arch}`;
const archive = `${base}.${platform === 'win32' ? 'zip' : 'tar.gz'}`;
const baseUrl = `https://nodejs.org/dist/v${nodeVersion}/`;
const [download, checksums] = await Promise.all([fetch(baseUrl + archive), fetch(baseUrl + 'SHASUMS256.txt')]);
if (!download.ok || !checksums.ok) throw new Error('Unable to download bundled Node runtime');
const bytes = Buffer.from(await download.arrayBuffer());
const expected = (await checksums.text()).split('\n').find((line) => line.endsWith(`  ${archive}`))?.split(' ')[0];
if (!expected || createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error('Node runtime checksum mismatch');
const archivePath = join(stage, archive);
await writeFile(archivePath, bytes);
if (platform === 'win32') {
  await run('tar.exe', ['-xf', archivePath, '-C', stage]);
} else {
  await run('tar', ['-xzf', archivePath, '-C', stage]);
}
await cp(join(stage, base), join(stage, 'runtime'), { recursive: true, dereference: false, verbatimSymlinks: true });
await rm(join(stage, base), { recursive: true });
await rm(archivePath);
// node-pty's macOS helper must remain executable in the packaged resources.
if (platform === 'darwin') {
  for (const directory of ['build/Release', `prebuilds/darwin-${arch}`]) {
    await chmod(join(server, 'node_modules/node-pty', directory, 'spawn-helper'), 0o755).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
await collectLicenses(root, join(stage, 'licenses'));
const saved = await pruneDesktop(stage, platform, arch);
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const report = { version, platform, arch, nodeVersion,
  buildId: (await readFile(join(server, '.next/BUILD_ID'), 'utf8')).trim(),
  savedBytes: saved };
await mkdir(join(stage, 'debug'), { recursive: true });
await writeFile(join(stage, 'debug/build.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Removed ${(Object.values(saved).reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB from shipping resources. Debug maps: .desktop/debug.`);
console.log(`Desktop resources prepared for ${platform}-${arch}. Run npm run desktop:pack or npm run desktop:dist.`);
