import type { AgentMessage as SdkAgentMessage } from "@earendil-works/pi-agent-core";
import type { JsonAgentSessionEvent } from "@earendil-works/pi-coding-agent";
import type { AgentEventLike, ClientMessageUpdateEvent } from "./agent-event-wire";
import type { RawAgentMessage } from "./normalize";
import type { AgentMessage, ExtensionUiRequest } from "./types";

type ToolStart = Pick<Extract<JsonAgentSessionEvent, { type: "tool_execution_start" }>, "type" | "toolCallId" | "toolName">;
type ToolUpdate = Pick<Extract<JsonAgentSessionEvent, { type: "tool_execution_update" }>, "type" | "toolCallId" | "toolName" | "partialResult">;
type ToolEnd = Pick<Extract<JsonAgentSessionEvent, { type: "tool_execution_end" }>, "type" | "toolCallId">;
type CompactionEnd = {
  type: "compaction_end" | "auto_compaction_end";
  result?: unknown;
  reason?: string;
  aborted?: boolean;
  errorMessage?: string;
};

/** Events consumed by the chat. Unknown SDK/extension events stay at the transport boundary. */
export type ClientAgentEvent =
  | { type: "connected"; isStreaming?: boolean }
  | { type: "agent_start" | "agent_end" | "agent_settled" | "prompt_done" | "auto_retry_end" }
  | { type: "prompt_error"; errorMessage?: string }
  | { type: "extension_error"; error?: string }
  | { type: "message_start"; message: RawAgentMessage }
  | { type: "message_end"; message: RawAgentMessage }
  | ClientMessageUpdateEvent
  | ToolStart | ToolUpdate | ToolEnd
  | { type: "queue_update"; steering: string[]; followUp: string[] }
  | { type: "auto_retry_start"; attempt: number; maxAttempts: number; errorMessage?: string }
  | { type: "compaction_start" | "auto_compaction_start" }
  | CompactionEnd
  | ExtensionUiRequest
  | { type: "extension_ui_closed"; id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAssistantDelta(value: unknown): value is ClientMessageUpdateEvent["assistantMessageEvent"] {
  if (!isRecord(value)) return false;
  if (value.type === "start" || value.type === "done" || value.type === "error") return true;
  if (!Number.isInteger(value.contentIndex) || (value.contentIndex as number) < 0) return false;
  switch (value.type) {
    case "text_start":
    case "thinking_start": return true;
    case "text_delta":
    case "thinking_delta": return typeof value.delta === "string";
    case "text_end":
    case "thinking_end": return typeof value.content === "string";
    case "toolcall_start":
    case "toolcall_delta":
      return (value.type !== "toolcall_delta" || typeof value.delta === "string")
        && (value.id === undefined || typeof value.id === "string")
        && (value.toolName === undefined || typeof value.toolName === "string");
    case "toolcall_end":
      return isRecord(value.toolCall) && typeof value.toolCall.id === "string"
        && typeof value.toolCall.name === "string" && isRecord(value.toolCall.arguments);
    default: return false;
  }
}

/** Check the message envelope; SDK-owned content is normalized in one adapter. */
function isMessage(value: unknown): value is AgentMessage | SdkAgentMessage {
  if (!isRecord(value)) return false;
  switch (value.role) {
    case "assistant":
    case "user":
    case "custom":
    case "toolResult":
      return typeof value.content === "string" || Array.isArray(value.content);
    case "bashExecution":
      return typeof value.command === "string" && typeof value.output === "string";
    case "branchSummary":
    case "compactionSummary":
      return typeof value.summary === "string";
    default:
      return false;
  }
}

function isExtensionRequest(event: AgentEventLike): event is AgentEventLike & ExtensionUiRequest {
  if (typeof event.id !== "string") return false;
  switch (event.method) {
    case "select": return typeof event.title === "string" && stringArray(event.options);
    case "confirm": return typeof event.title === "string" && typeof event.message === "string";
    case "input":
    case "editor": return typeof event.title === "string";
    case "notify": return typeof event.message === "string";
    case "setStatus": return typeof event.statusKey === "string";
    case "setWidget": return typeof event.widgetKey === "string" && (event.widgetLines === undefined || stringArray(event.widgetLines));
    case "setTitle": return typeof event.title === "string";
    case "set_editor_text": return typeof event.text === "string";
    case "custom": return stringArray(event.lines);
    default: return false;
  }
}

/** Ignore unknown event kinds, and reject malformed fields used by the chat. */
export function parseClientAgentEvent(event: AgentEventLike): ClientAgentEvent | null {
  switch (event.type) {
    case "connected": return { type: event.type, isStreaming: event.isStreaming === true };
    case "agent_start":
    case "agent_end":
    case "agent_settled":
    case "prompt_done":
    case "auto_retry_end":
    case "compaction_start":
    case "auto_compaction_start": return { type: event.type };
    case "prompt_error": return { type: event.type, errorMessage: typeof event.errorMessage === "string" ? event.errorMessage : undefined };
    case "extension_error": return { type: event.type, error: typeof event.error === "string" ? event.error : undefined };
    case "message_start":
    case "message_end":
      return isMessage(event.message) ? { type: event.type, message: event.message } : null;
    case "message_update": {
      const delta = event.assistantMessageEvent;
      return isAssistantDelta(delta) ? { type: event.type, assistantMessageEvent: delta } : null;
    }
    case "tool_execution_start":
      return typeof event.toolCallId === "string" && typeof event.toolName === "string"
        ? { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName } : null;
    case "tool_execution_update":
      return typeof event.toolCallId === "string" && typeof event.toolName === "string"
        ? { type: event.type, toolCallId: event.toolCallId, toolName: event.toolName, partialResult: event.partialResult } : null;
    case "tool_execution_end":
      return typeof event.toolCallId === "string" ? { type: event.type, toolCallId: event.toolCallId } : null;
    case "queue_update":
      return {
        type: event.type,
        steering: stringArray(event.steering) ? event.steering : [],
        followUp: stringArray(event.followUp) ? event.followUp : [],
      };
    case "auto_retry_start":
      return typeof event.attempt === "number" && typeof event.maxAttempts === "number"
        ? { type: event.type, attempt: event.attempt, maxAttempts: event.maxAttempts, errorMessage: typeof event.errorMessage === "string" ? event.errorMessage : undefined } : null;
    case "compaction_end":
    case "auto_compaction_end":
      return {
        type: event.type,
        result: event.result,
        reason: typeof event.reason === "string" ? event.reason : undefined,
        aborted: event.aborted === true,
        errorMessage: typeof event.errorMessage === "string" ? event.errorMessage : undefined,
      };
    case "extension_ui_request": return isExtensionRequest(event) ? event : null;
    case "extension_ui_closed": return typeof event.id === "string" ? { type: event.type, id: event.id } : null;
    default: return null;
  }
}
