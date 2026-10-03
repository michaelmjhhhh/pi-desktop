import type { AgentMessage as SdkAgentMessage } from "@earendil-works/pi-agent-core";
import type { ThinkingContent as SdkThinkingContent, ToolCall as SdkToolCall } from "@earendil-works/pi-ai";
import type { AgentMessage, AssistantContentBlock, ToolCallContent } from "./types";

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function streamingRawInput(block: Record<string, unknown>): string | undefined {
  if (typeof block.rawInput === "string") return block.rawInput;
  if (typeof block.partialJson === "string") return block.partialJson;
  if (typeof block.partialArgs === "string") return block.partialArgs;

  const customInput = isObject(block.customInput) ? block.customInput : null;
  const property = customInput && typeof customInput.property === "string"
    ? customInput.property
    : null;
  const args = isObject(block.arguments) ? block.arguments : null;
  return property && args && typeof args[property] === "string"
    ? args[property]
    : undefined;
}

function normalizeToolCallBlock(
  block: unknown,
  options: { includeStreamingRawInput?: boolean } = {},
): ToolCallContent | null {
  if (!isObject(block) || block.type !== "toolCall") return null;
  const normalized: ToolCallContent = {
    type: "toolCall",
    toolCallId: typeof block.toolCallId === "string" ? block.toolCallId : (typeof block.id === "string" ? block.id : ""),
    toolName: typeof block.toolName === "string" ? block.toolName : (typeof block.name === "string" ? block.name : ""),
    input: typeof block.input === "object" && block.input !== null && !Array.isArray(block.input)
      ? block.input as Record<string, unknown>
      : (typeof block.arguments === "object" && block.arguments !== null && !Array.isArray(block.arguments)
        ? block.arguments as Record<string, unknown>
        : {}),
  };
  const rawInput = options.includeStreamingRawInput ? streamingRawInput(block) : undefined;
  return rawInput === undefined ? normalized : { ...normalized, rawInput };
}

export type RawAgentMessage = AgentMessage | SdkAgentMessage;
type RawBlock = AssistantContentBlock | SdkThinkingContent | SdkToolCall;

function normalizeAssistantBlock(
  block: RawBlock,
  options: { includeStreamingRawInput?: boolean },
): AssistantContentBlock {
  if (block.type === "toolCall") return normalizeToolCallBlock(block, options)!;
  return block;
}

function normalizeAssistantToolCalls(
  msg: RawAgentMessage,
  options: { includeStreamingRawInput?: boolean } = {},
): AgentMessage {
  switch (msg.role) {
    case "assistant": {
      // Legacy JSONL messages may have a text string instead of content blocks.
      const content: unknown = msg.content;
      if (typeof content === "string") return { ...msg, content: [{ type: "text", text: content }] };
      return { ...msg, content: msg.content.map((block) => normalizeAssistantBlock(block, options)) };
    }
    default:
      return msg;
  }
}

export function normalizeToolCalls(msg: RawAgentMessage): AgentMessage {
  return normalizeAssistantToolCalls(msg);
}

export function normalizeStreamingToolCalls(msg: RawAgentMessage): AgentMessage {
  return normalizeAssistantToolCalls(msg, { includeStreamingRawInput: true });
}
