import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { parseClientAgentEvent } = await jiti.import("./client-agent-event.ts");
const { streamReducer, INITIAL_STREAMING_STATE } = await jiti.import("./streaming-message.ts");

test("stream decoding preserves partial tool arguments and both image encodings", () => {
  const sdkImage = { type: "image", data: "YWJj", mimeType: "image/png" };
  const legacyImage = { type: "image", source: { type: "base64", data: "YWJj", media_type: "image/png" } };
  const message = { role: "assistant", content: [
    { type: "toolCall", id: "tool-1", name: "write", arguments: {}, partialJson: '{"path":"file' },
    sdkImage, legacyImage,
  ] };
  const event = parseClientAgentEvent({ type: "message_start", message });
  assert.equal(event.message, message);
  const state = streamReducer(INITIAL_STREAMING_STATE, { type: "snapshot", message: event.message });
  assert.equal(state.streamingMessage.content[0].rawInput, '{"path":"file');
  assert.equal(state.streamingMessage.content[1], sdkImage);
  assert.equal(state.streamingMessage.content[2], legacyImage);
});

test("unknown or malformed events are ignored while old compaction events remain supported", () => {
  for (const event of [
    { type: "future_sdk_event", payload: {} },
    { type: "message_start", message: null },
    { type: "message_update", assistantMessageEvent: [] },
    { type: "message_update", assistantMessageEvent: { type: "toolcall_end", contentIndex: 0 } },
    { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: 12 } },
    { type: "tool_execution_start", toolCallId: 12, toolName: "read" },
    { type: "auto_retry_start", attempt: "1", maxAttempts: 3 },
    { type: "extension_ui_request", id: "request", method: "select", title: "Pick", options: "bad" },
  ]) assert.equal(parseClientAgentEvent(event), null);
  const result = { tokensBefore: 100 };
  assert.deepEqual(parseClientAgentEvent({ type: "auto_compaction_end", result, aborted: false }), {
    type: "auto_compaction_end", result, reason: undefined, aborted: false, errorMessage: undefined,
  });
  assert.deepEqual(parseClientAgentEvent({ type: "tool_execution_end", toolCallId: "tool-1" }), {
    type: "tool_execution_end", toolCallId: "tool-1",
  });
});

test("extension dialog decoding retains cancellation deadlines and widget clearing", () => {
  const request = { type: "extension_ui_request", id: "request", method: "input", title: "Name", timeout: 100, expiresAt: 12345 };
  assert.equal(parseClientAgentEvent(request), request);
  const clearWidget = { type: "extension_ui_request", id: "widget-request", method: "setWidget", widgetKey: "status" };
  assert.equal(parseClientAgentEvent(clearWidget), clearWidget);
  assert.deepEqual(parseClientAgentEvent({ type: "queue_update", steering: [1], followUp: ["valid"] }), {
    type: "queue_update", steering: [], followUp: ["valid"],
  });
});
