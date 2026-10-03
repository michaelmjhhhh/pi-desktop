import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  normalizeStreamingToolCalls,
  normalizeToolCalls,
} = await jiti.import("./normalize.ts");

function assistant(block) {
  return {
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  };
}

test("keeps SDK scratch input only for an in-flight snapshot", () => {
  const message = assistant({
    type: "toolCall",
    id: "call-1",
    name: "write",
    arguments: { path: "/tmp/file" },
    partialJson: '{"path":"/tmp/file","content":"hel',
  });

  assert.deepEqual(normalizeStreamingToolCalls(message).content[0], {
    type: "toolCall",
    toolCallId: "call-1",
    toolName: "write",
    input: { path: "/tmp/file" },
    rawInput: '{"path":"/tmp/file","content":"hel',
  });
  assert.deepEqual(normalizeToolCalls(message).content[0], {
    type: "toolCall",
    toolCallId: "call-1",
    toolName: "write",
    input: { path: "/tmp/file" },
  });
});

test("removes a client raw buffer when normalizing a completed message", () => {
  const message = assistant({
    type: "toolCall",
    toolCallId: "call-2",
    toolName: "write",
    input: { path: "/tmp/file", content: "complete" },
    rawInput: "temporary",
  });

  assert.equal(Object.hasOwn(normalizeToolCalls(message).content[0], "rawInput"), false);
});

test("SDK image fields survive normalization without changing their shape", () => {
  const image = { type: "image", data: "aGVsbG8=", mimeType: "image/png", extra: "retained" };
  const normalized = normalizeToolCalls({ role: "toolResult", toolCallId: "call", content: [image], details: { retained: true } });
  assert.deepEqual(normalized.content[0], image);
  assert.deepEqual(normalized.details, { retained: true });
});

test("SDK summary message roles and legacy assistant text survive normalization", () => {
  for (const role of ["branchSummary", "compactionSummary"]) {
    const message = { role, summary: "preserved", fromId: "entry", tokensBefore: 100, timestamp: 123 };
    assert.equal(normalizeToolCalls(message), message);
  }
  assert.deepEqual(normalizeToolCalls({ ...assistant({ type: "text", text: "unused" }), content: "legacy" }).content, [{ type: "text", text: "legacy" }]);
});
