import type { CompactionResult, SlashCommandInfo } from "@earendil-works/pi-coding-agent";
import type { AgentStateResponse } from "./agent-state-types";
import { validateAgentImages } from "./image-attachments";
import type { SessionStatsInfo } from "./pi-types";
import { isThinkingLevel, type ThinkingLevel } from "./thinking-levels";
import type { ToolEntry } from "./tool-presets";
import type { ExtensionUiResponse } from "./types";

export interface AgentImage {
  type: "image";
  data: string;
  mimeType: string;
}

type MessageCommand = { message: string; images?: AgentImage[] };

/** toolNames also selects tools when a dormant existing session is started. */
export type AgentCommand = (
  | ({ type: "prompt"; streamingBehavior?: "steer" | "followUp" } & MessageCommand)
  | ({ type: "steer" | "follow_up" } & MessageCommand)
  | { type: "abort" | "get_state" | "get_session_stats" | "get_last_assistant_text" | "clear_queue" | "get_tools" | "get_commands" | "reload" | "abort_compaction" | "abort_bash" }
  | { type: "set_model"; provider: string; modelId: string }
  | { type: "fork" | "fork_branch"; entryId: string }
  | { type: "clone"; leafId?: string | null }
  | { type: "navigate_tree"; targetId: string }
  | { type: "set_thinking_level"; level: ThinkingLevel }
  | { type: "compact"; customInstructions?: string }
  | { type: "set_session_name"; name: string }
  | { type: "set_auto_compaction" | "set_auto_retry"; enabled: boolean }
  | { type: "set_tools"; toolNames: string[] }
  | ExtensionUiResponse
  | { type: "extension_ui_input"; id: string; data: string }
  | { type: "bash"; command: string; excludeFromContext?: boolean }
) & { toolNames?: string[] };

export type AgentCommandType = AgentCommand["type"];
export type AgentTool = ToolEntry & { sourceInfo?: unknown };
export type AgentSessionCopyResult = { cancelled: true; newSessionId?: undefined } | { cancelled: false; newSessionId: string };
export type AgentState = AgentStateResponse & {
  sessionId: string;
  sessionFile: string;
  model?: { id: string; provider: string };
  autoCompactionEnabled: boolean;
  autoRetryEnabled: boolean;
  pendingMessageCount: number;
};

/** Results produced by the in-process session wrapper. */
export interface AgentCommandResultMap {
  prompt: null;
  steer: null;
  follow_up: null;
  abort: null;
  get_state: AgentState;
  set_model: { id: string; provider: string };
  fork: AgentSessionCopyResult;
  fork_branch: AgentSessionCopyResult;
  clone: AgentSessionCopyResult;
  navigate_tree: { cancelled: boolean };
  set_thinking_level: null;
  compact: CompactionResult;
  set_session_name: null;
  get_session_stats: SessionStatsInfo;
  get_last_assistant_text: { text: string };
  set_auto_compaction: null;
  clear_queue: { steering: string[]; followUp: string[] };
  get_tools: AgentTool[];
  get_commands: { commands: SlashCommandInfo[] };
  set_tools: null;
  reload: { success: true };
  abort_compaction: null;
  extension_ui_response: null;
  extension_ui_input: null;
  set_auto_retry: null;
  bash: { output: string; exitCode?: number; cancelled?: boolean; truncated?: boolean; fullOutputPath?: string };
  abort_bash: null;
}

export type AgentCommandResult<T extends AgentCommandType> = AgentCommandResultMap[T];
/** The HTTP route coordinates wrapper recreation for tool-selection changes. */
export type AgentClientCommandResult<T extends AgentCommandType> = T extends "set_tools"
  ? { sessionId: string; recreated: boolean }
  : AgentCommandResult<T>;

export class AgentProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentProtocolError";
  }
}

/** Only JSON decoding failures are bad requests; SDK/config SyntaxErrors are server failures. */
export async function readAgentRequestBody(request: Pick<Request, "json">): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new AgentProtocolError("Invalid JSON request body");
    throw error;
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AgentProtocolError("Command must be an object");
  }
  return value as Record<string, unknown>;
}

export function getAgentCommandType(value: unknown): string | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && "type" in value && typeof value.type === "string" ? value.type : undefined;
}

function stringField(body: Record<string, unknown>, key: string, allowEmpty = false): string {
  const value = body[key];
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new AgentProtocolError(`${key} must be ${allowEmpty ? "a string" : "a nonempty string"}`);
  }
  return value;
}

function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  return body[key] === undefined ? undefined : stringField(body, key, true);
}

function booleanField(body: Record<string, unknown>, key: string): boolean {
  if (typeof body[key] !== "boolean") throw new AgentProtocolError(`${key} must be a boolean`);
  return body[key];
}

function parseToolNames(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((name) => typeof name !== "string")) {
    throw new AgentProtocolError("toolNames must be an array of strings");
  }
  return [...value];
}

/** Validate external JSON once, before creating a session or invoking the SDK. */
export function parseAgentCommand(value: unknown): AgentCommand {
  const body = record(value);
  const type = stringField(body, "type");
  const toolNames = parseToolNames(body.toolNames);
  const startupTools = toolNames === undefined ? {} : { toolNames };
  switch (type) {
    case "prompt":
    case "steer":
    case "follow_up": {
      const message = stringField(body, "message", true);
      const imageError = validateAgentImages(body.images);
      if (imageError) throw new AgentProtocolError(imageError);
      const images = body.images as AgentImage[] | undefined;
      const payload = { message, ...(images === undefined ? {} : { images }) };
      if (type !== "prompt") return { type, ...payload, ...startupTools };
      const behavior = body.streamingBehavior;
      if (behavior !== undefined && behavior !== "steer" && behavior !== "followUp") {
        throw new AgentProtocolError("streamingBehavior must be steer or followUp");
      }
      return { type, ...payload, ...(behavior === undefined ? {} : { streamingBehavior: behavior }), ...startupTools };
    }
    case "abort": case "get_state": case "get_session_stats": case "get_last_assistant_text":
    case "clear_queue": case "get_tools": case "get_commands": case "reload":
    case "abort_compaction": case "abort_bash":
      return { type, ...startupTools };
    case "set_model":
      return { type, provider: stringField(body, "provider"), modelId: stringField(body, "modelId"), ...startupTools };
    case "fork": case "fork_branch":
      return { type, entryId: stringField(body, "entryId"), ...startupTools };
    case "clone": {
      const leafId = body.leafId === null ? null : optionalString(body, "leafId");
      return { type, ...(leafId === undefined ? {} : { leafId }), ...startupTools };
    }
    case "navigate_tree":
      return { type, targetId: stringField(body, "targetId"), ...startupTools };
    case "set_thinking_level":
      if (!isThinkingLevel(body.level)) throw new AgentProtocolError("Invalid thinking level");
      return { type, level: body.level, ...startupTools };
    case "compact": {
      const customInstructions = optionalString(body, "customInstructions");
      return { type, ...(customInstructions === undefined ? {} : { customInstructions }), ...startupTools };
    }
    case "set_session_name":
      return { type, name: stringField(body, "name"), ...startupTools };
    case "set_auto_compaction": case "set_auto_retry":
      return { type, enabled: booleanField(body, "enabled"), ...startupTools };
    case "set_tools":
      if (toolNames === undefined) throw new AgentProtocolError("toolNames must be an array of strings");
      return { type, toolNames };
    case "extension_ui_response": {
      const id = stringField(body, "id");
      const fields = ["value", "confirmed", "cancelled"].filter((key) => body[key] !== undefined);
      if (fields.length !== 1) throw new AgentProtocolError("Provide exactly one extension response: value, confirmed, or cancelled");
      if (fields[0] === "value") return { type, id, value: stringField(body, "value", true), ...startupTools };
      if (fields[0] === "confirmed") return { type, id, confirmed: booleanField(body, "confirmed"), ...startupTools };
      if (body.cancelled !== true) throw new AgentProtocolError("cancelled must be true");
      return { type, id, cancelled: true, ...startupTools };
    }
    case "extension_ui_input":
      return { type, id: stringField(body, "id"), data: stringField(body, "data", true), ...startupTools };
    case "bash": {
      const excludeFromContext = body.excludeFromContext === undefined ? undefined : booleanField(body, "excludeFromContext");
      return { type, command: stringField(body, "command", true), ...(excludeFromContext === undefined ? {} : { excludeFromContext }), ...startupTools };
    }
    default:
      throw new AgentProtocolError(`Unsupported command: ${type}`);
  }
}

export interface NewAgentRequest {
  cwd: string;
  command: AgentCommand | { type: "ensure_session" };
  toolNames?: string[];
  initialModel?: { provider: string; modelId: string };
  thinkingLevel?: ThinkingLevel;
}

export function parseNewAgentRequest(value: unknown): NewAgentRequest {
  const body = record(value);
  const cwd = stringField(body, "cwd");
  const provider = body.provider === undefined ? undefined : stringField(body, "provider");
  const modelId = body.modelId === undefined ? undefined : stringField(body, "modelId");
  if ((provider !== undefined) !== (modelId !== undefined)) {
    throw new AgentProtocolError("provider and modelId must be provided together as nonempty strings");
  }
  const toolNames = parseToolNames(body.toolNames);
  if (body.thinkingLevel !== undefined && !isThinkingLevel(body.thinkingLevel)) {
    throw new AgentProtocolError("Invalid thinking level");
  }
  const command = body.type === "ensure_session" ? { type: "ensure_session" as const } : parseAgentCommand(body);
  return {
    cwd,
    command,
    ...(toolNames === undefined ? {} : { toolNames }),
    ...(provider !== undefined && modelId !== undefined ? { initialModel: { provider, modelId } } : {}),
    ...(body.thinkingLevel === undefined ? {} : { thinkingLevel: body.thinkingLevel as ThinkingLevel }),
  };
}
