import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
const { reparentSessionChildren } = await createJiti(import.meta.url).import("./session-deletion.ts");

function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "pi-session-delete-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const target = join(root, "target.jsonl");
  const child = join(root, "child.jsonl");
  writeFileSync(target, '{"type":"session","id":"target"}\n');
  const tail = '{"type":"message","message":{"role":"user","content":"preserve me"}}\n';
  writeFileSync(child, JSON.stringify({ type: "session", id: "child", parentSession: target, extra: true }) + '\n'
    + JSON.stringify({ type: "custom", customType: "pi-web:subagent", data: { parentSessionId: "target", other: 1 } }) + '\n' + tail);
  return { root, target, child, tail };
}

test("reparenting preserves messages and updates child header and subagent metadata", (t) => {
  const { root, target, child, tail } = setup(t);
  const parent = join(root, "grandparent.jsonl");
  writeFileSync(join(root, "malformed.jsonl"), 'null\ninvalid\n');
  reparentSessionChildren(target, parent, "grandparent");
  const contents = readFileSync(child, "utf8");
  const lines = contents.split('\n');
  assert.equal(JSON.parse(lines[0]).parentSession, parent);
  assert.equal(JSON.parse(lines[0]).extra, true);
  assert.deepEqual(JSON.parse(lines[1]).data, { parentSessionId: "grandparent", parentSessionPath: parent, other: 1 });
  assert.ok(contents.endsWith(tail));
  reparentSessionChildren(parent, undefined, undefined);
  assert.equal(JSON.parse(readFileSync(child, "utf8").split('\n')[0]).parentSession, undefined);
});

test("read failures happen before any child write and propagate", (t) => {
  const { target } = setup(t);
  let writes = 0;
  const failure = Object.assign(new Error("unreadable"), { code: "EACCES" });
  assert.throws(() => reparentSessionChildren(target, undefined, undefined, {
    readdir: () => ["first.jsonl", "second.jsonl"],
    read: (path) => { if (path.endsWith("second.jsonl")) throw failure; return JSON.stringify({ type: "session", parentSession: target }); },
    write: () => { writes++; },
  }), (error) => error === failure);
  assert.equal(writes, 0);
});

test("write and directory failures propagate without changing the failed child", (t) => {
  const { target, child } = setup(t);
  const before = readFileSync(child, "utf8");
  const failure = Object.assign(new Error("disk full"), { code: "ENOSPC" });
  assert.throws(() => reparentSessionChildren(target, undefined, undefined, {
    readdir: () => ["child.jsonl"], read: () => before, write: () => { throw failure; },
  }), (error) => error === failure);
  assert.equal(readFileSync(child, "utf8"), before);
  assert.throws(() => reparentSessionChildren(target, undefined, undefined, {
    readdir: () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); },
    read: () => "", write: () => {},
  }), /denied/);
});

test("a child removed after directory enumeration is skipped", (t) => {
  const { target } = setup(t);
  let writes = 0;
  reparentSessionChildren(target, undefined, undefined, {
    readdir: () => ["removed.jsonl"],
    read: () => { throw Object.assign(new Error("removed"), { code: "ENOENT" }); },
    write: () => { writes++; },
  });
  assert.equal(writes, 0);
});
