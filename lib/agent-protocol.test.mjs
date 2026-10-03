import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { AgentProtocolError, getAgentCommandType, parseAgentCommand, parseNewAgentRequest } = await jiti.import("./agent-protocol.ts");

const image = { type: "image", data: "AQID", mimeType: "image/png" };

test("commands validate externally supplied fields before SDK dispatch", () => {
  for (const command of [
    { type: "prompt", message: "", images: [image], streamingBehavior: "followUp" },
    { type: "steer", message: "adjust", images: [] },
    { type: "follow_up", message: "next" },
    { type: "set_model", provider: "provider", modelId: "model" },
    { type: "fork", entryId: "entry" },
    { type: "fork_branch", entryId: "entry" },
    { type: "clone", leafId: null },
    { type: "navigate_tree", targetId: "entry" },
    { type: "set_thinking_level", level: "max" },
    { type: "compact", customInstructions: "" },
    { type: "set_session_name", name: "name" },
    { type: "set_auto_compaction", enabled: false },
    { type: "set_auto_retry", enabled: true },
    { type: "set_tools", toolNames: [] },
    { type: "extension_ui_response", id: "dialog", value: "" },
    { type: "extension_ui_response", id: "dialog", confirmed: false },
    { type: "extension_ui_response", id: "dialog", cancelled: true },
    { type: "extension_ui_input", id: "terminal", data: "\u0003" },
    { type: "bash", command: "pwd", excludeFromContext: false },
    ...["abort", "get_state", "get_session_stats", "get_last_assistant_text", "clear_queue", "get_tools", "get_commands", "reload", "abort_compaction", "abort_bash"].map((type) => ({ type })),
  ]) {
    assert.deepEqual(parseAgentCommand({ ...command, ignored: "not dispatched" }), command);
  }
});

test("invalid commands are rejected without coercing or forwarding unknown values", () => {
  for (const command of [
    null, [], "prompt", {}, { type: "unsupported" }, { type: "ensure_session" },
    { type: "prompt", message: 42 },
    { type: "prompt", message: "hello", streamingBehavior: "follow_up" },
    { type: "prompt", message: "hello", images: [{ ...image, data: "invalid" }] },
    { type: "steer", message: "hello", images: null },
    { type: "set_model", provider: "provider" },
    { type: "fork", entryId: "" },
    { type: "navigate_tree", targetId: null },
    { type: "clone", leafId: 1 },
    { type: "set_thinking_level", level: "auto" },
    { type: "set_auto_retry", enabled: "false" },
    { type: "set_session_name", name: " " },
    { type: "compact", customInstructions: 1 },
    { type: "set_tools" },
    { type: "get_state", toolNames: ["read", 1] },
    { type: "extension_ui_input", id: "terminal", data: 3 },
    { type: "extension_ui_response", id: "dialog" },
    { type: "extension_ui_response", id: "dialog", cancelled: false },
    { type: "extension_ui_response", id: "dialog", confirmed: "false" },
    { type: "extension_ui_response", id: "dialog", value: "yes", confirmed: true },
    { type: "bash", command: "pwd", excludeFromContext: 1 },
  ]) assert.throws(() => parseAgentCommand(command), AgentProtocolError);
});

test("startup tool selection distinguishes omitted tools from Chat only", () => {
  assert.deepEqual(parseAgentCommand({ type: "get_state" }), { type: "get_state" });
  assert.deepEqual(parseAgentCommand({ type: "get_state", toolNames: [] }), { type: "get_state", toolNames: [] });
  assert.deepEqual(parseNewAgentRequest({ cwd: "/project", type: "ensure_session" }), {
    cwd: "/project", command: { type: "ensure_session" },
  });
  assert.deepEqual(parseNewAgentRequest({ cwd: "/project", type: "ensure_session", toolNames: [] }), {
    cwd: "/project", command: { type: "ensure_session" }, toolNames: [],
  });
});

test("new requests validate atomic model/thinking preferences and first commands", () => {
  assert.deepEqual(parseNewAgentRequest({
    cwd: "/project", type: "prompt", message: "hello", provider: "provider", modelId: "model", thinkingLevel: "off",
  }), {
    cwd: "/project", command: { type: "prompt", message: "hello" },
    initialModel: { provider: "provider", modelId: "model" }, thinkingLevel: "off",
  });
  for (const invalid of [
    null, [], { cwd: 42, type: "ensure_session" },
    { cwd: "/project", type: "ensure_session", provider: "provider" },
    { cwd: "/project", type: "ensure_session", provider: 42, modelId: "model" },
    { cwd: "/project", type: "ensure_session", provider: " ", modelId: "model" },
    { cwd: "/project", type: "ensure_session", thinkingLevel: "auto" },
    { cwd: "/project", type: "ensure_session", toolNames: "read" },
    { cwd: "/project", type: "prompt", message: false },
    { cwd: "/project", type: "unsupported" },
  ]) assert.throws(() => parseNewAgentRequest(invalid), AgentProtocolError);
});

test("raw prompt identity survives validation failure for negative acknowledgements", () => {
  const malformedPrompt = { type: "prompt", message: null };
  assert.equal(getAgentCommandType(malformedPrompt), "prompt");
  assert.throws(() => parseAgentCommand(malformedPrompt), AgentProtocolError);
  for (const value of [null, [], 1, { type: 1 }]) assert.equal(getAgentCommandType(value), undefined);
});
