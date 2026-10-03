import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const { POST: sendCommand } = await jiti.import("./[id]/route.ts");
const { POST: newSession } = await jiti.import("./new/route.ts");
const context = { params: Promise.resolve({ id: "protocol-test" }) };
const request = (body) => new Request("http://localhost/api/agent/protocol-test", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("malformed route commands fail before looking up or creating runtimes", async (t) => {
  const previous = globalThis.__piSessions;
  let lookups = 0;
  globalThis.__piSessions = new class extends Map {
    get(key) { lookups++; return super.get(key); }
  }();
  t.after(() => { globalThis.__piSessions = previous; });
  for (const body of [null, [], { type: "unknown" }, { type: "set_tools", toolNames: false }]) {
    const response = await sendCommand(request(body), context);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).accepted, undefined);
  }
  const rejected = await sendCommand(request({ type: "prompt", message: 123 }), context);
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), {
    error: "message must be a string", code: "prompt_rejected", accepted: false,
  });
  for (const body of [
    { cwd: process.cwd(), type: "prompt", message: false },
    { cwd: process.cwd(), type: "ensure_session", thinkingLevel: "auto" },
    { cwd: process.cwd(), type: "ensure_session", toolNames: "read" },
    { cwd: process.cwd(), type: "ensure_session", provider: "provider" },
  ]) {
    const response = await newSession(request(body));
    assert.equal(response.status, 400);
    const result = await response.json();
    assert.equal(result.accepted, body.type === "prompt" ? false : undefined);
  }
  for (const route of [newSession, (req) => sendCommand(req, context)]) {
    const response = await route(new Request("http://localhost/api/agent", { method: "POST", body: "{" }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "Invalid JSON request body");
  }
  assert.equal(lookups, 0);
  assert.equal(globalThis.__piSessions.size, 0);
});

test("existing command routes retain acceptance and sanitized payload semantics", async (t) => {
  const previous = globalThis.__piSessions;
  const sent = [];
  const session = {
    isAlive: () => true,
    send: async (command) => { sent.push(command); return null; },
  };
  globalThis.__piSessions = new Map([["protocol-test", session]]);
  t.after(() => { globalThis.__piSessions = previous; });
  const accepted = await sendCommand(request({ type: "prompt", message: "hello", toolNames: [], ignored: true }), context);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { success: true, data: null });
  assert.deepEqual(sent, [{ type: "prompt", message: "hello", toolNames: [] }]);

  session.send = async () => { throw new Error("Preflight rejected"); };
  const rejected = await sendCommand(request({ type: "prompt", message: "hello" }), context);
  assert.equal(rejected.status, 500);
  assert.deepEqual(await rejected.json(), { error: "Preflight rejected", code: "prompt_rejected", accepted: false });

  session.send = async () => { throw new SyntaxError("Corrupt runtime configuration"); };
  const corrupt = await sendCommand(request({ type: "get_state" }), context);
  assert.equal(corrupt.status, 500);
  assert.equal((await corrupt.json()).error, "Corrupt runtime configuration");

  // Serialization failing after send resolved must not claim the prompt was rejected.
  session.send = async () => 1n;
  const ambiguous = await sendCommand(request({ type: "prompt", message: "hello" }), context);
  assert.equal(ambiguous.status, 500);
  assert.equal((await ambiguous.json()).accepted, undefined);
});
