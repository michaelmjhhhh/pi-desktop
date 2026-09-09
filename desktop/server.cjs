/* eslint-disable @typescript-eslint/no-require-imports */
// Runs in the bundled Node runtime, keeping native modules on the Node ABI.
const { createServer } = require('node:http');
const { join } = require('node:path');
const { timingSafeEqual } = require('node:crypto');
const root = process.env.PI_DESKTOP_SERVER_ROOT;
const token = process.env.PI_DESKTOP_TOKEN;
if (!root || !token || !process.send) throw new Error('Launch this server through Pi Desktop');
delete process.env.PI_DESKTOP_TOKEN;
process.chdir(root);
const config = require(join(root, '.next', 'required-server-files.json')).config;
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
const next = require(require.resolve('next', { paths: [root] }));
const application = next({ dev: false, dir: root, conf: config });
const handle = application.getRequestHandler();
function authenticated(value) {
  return typeof value === 'string' && Buffer.byteLength(value) === Buffer.byteLength(token)
    && timingSafeEqual(Buffer.from(value), Buffer.from(token));
}
const server = createServer((request, response) => {
  if (!authenticated(request.headers['x-pi-desktop-token'])) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  delete request.headers['x-pi-desktop-token'];
  handle(request, response);
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(0), 5000);
  deadline.unref();
  server.close();
  server.closeAllConnections();
  await application.close();
  process.exit(0);
}
process.on('message', (message) => { if (message === 'shutdown') void shutdown(); });
process.on('disconnect', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
application.prepare().then(() => {
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
}).catch((error) => { console.error(error); process.exit(1); });
