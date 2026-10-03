import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const { SubagentError, subagentErrorStatus, readSubagentRequestJson } = await createJiti(import.meta.url).import("./subagent-errors.ts");
test("subagent response statuses use application codes rather than error prose", () => {
  assert.equal(subagentErrorStatus(new SubagentError("not_running", "Changed wording")), 409);
  assert.equal(subagentErrorStatus(new SubagentError("access_denied", "Changed wording")), 403);
  assert.equal(subagentErrorStatus(new SubagentError("invalid_request", "Changed wording")), 400);
  assert.equal(subagentErrorStatus(new Error("Subagent is not running: disk unavailable")), 500);
});

test("only request JSON syntax failures become invalid-request errors", async () => {
  await assert.rejects(readSubagentRequestJson(new Request("https://example.test", { method: "POST", body: "{" })),
    (error) => error instanceof SubagentError && subagentErrorStatus(error) === 400);
  assert.equal(subagentErrorStatus(new SyntaxError("Malformed stored metadata")), 500);
  assert.deepEqual(await readSubagentRequestJson(new Request("https://example.test", { method: "POST", body: '{"action":"abort"}' })), { action: "abort" });
});
