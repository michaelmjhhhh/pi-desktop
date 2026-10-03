import assert from "node:assert/strict";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

test("DELETE preserves the parent runtime and file when child reparenting fails", async (t) => {
  const root = fs.mkdtempSync(join(tmpdir(), "pi-delete-route-"));
  const fixture = join(root, "reparent-fixture.mjs");
  fs.writeFileSync(fixture, 'export function reparentSessionChildren() { throw new Error("child write failed"); }\n');
  const jiti = createJiti(import.meta.url, {
    alias: { "@/lib/session-deletion": fixture, "@": process.cwd() },
    moduleCache: false,
  });
  const { DELETE } = await jiti.import("./[id]/route.ts");
  const { cacheSessionPath, invalidateSessionPathCache } = await jiti.import("../../../lib/session-reader.ts");
  const id = "session-deletion-route-test";
  const filePath = join(root, "parent.jsonl");
  const original = JSON.stringify({ type: "session", id, cwd: root, timestamp: "2026-01-01T00:00:00Z" }) + '\n';
  fs.writeFileSync(filePath, original);
  cacheSessionPath(id, filePath);
  const previousSessions = globalThis.__piSessions;
  let shutdowns = 0;
  globalThis.__piSessions = new Map([[id, { shutdown: async () => { shutdowns++; } }]]);
  const unlink = t.mock.method(fs, "unlinkSync");
  t.after(() => {
    unlink.mock.restore();
    globalThis.__piSessions = previousSessions;
    invalidateSessionPathCache(id);
    fs.rmSync(root, { recursive: true, force: true });
  });
  const response = await DELETE(new Request("http://localhost/api/sessions/" + id, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /child write failed/);
  assert.equal(shutdowns, 0);
  assert.equal(unlink.mock.callCount(), 0);
  assert.equal(fs.readFileSync(filePath, "utf8"), original);
});
