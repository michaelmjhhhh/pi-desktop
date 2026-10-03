import type { AgentCommand, AgentClientCommandResult } from "./agent-protocol";

// Client-side helper for POST /api/agent/[id].
//
// Every /api/agent/[id] route returns one of:
//   { success: true, data: <result> }
//   { error: string }              (non-2xx)
//
// Call sites previously repeated the same 5-line fetch block 13× in
// hooks/useAgentSession.ts. This helper collapses that down to one line.

export class AgentCommandError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly accepted?: boolean,
  ) {
    super(message);
    this.name = "AgentCommandError";
  }
}

export function isPromptRejectedError(error: unknown): error is AgentCommandError {
  return error instanceof AgentCommandError
    && error.code === "prompt_rejected"
    && error.accepted === false;
}

export async function sendAgentCommand<C extends AgentCommand>(
  sessionId: string,
  command: C,
): Promise<AgentClientCommandResult<C["type"]>> {
  const res = await fetch(`/api/agent/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const parsed: unknown = await res.json().catch(() => null);
  const body = (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}) as {
    success?: boolean;
    data?: AgentClientCommandResult<C["type"]>;
    error?: string;
    code?: string;
    accepted?: boolean;
  };
  if (!res.ok || typeof body.error === "string") {
    throw new AgentCommandError(
      typeof body.error === "string" ? body.error : `HTTP ${res.status}`,
      res.status,
      typeof body.code === "string" ? body.code : undefined,
      typeof body.accepted === "boolean" ? body.accepted : undefined,
    );
  }
  if (body.success !== true || !("data" in body)) {
    throw new AgentCommandError("Invalid agent command response", res.status);
  }
  return body.data as AgentClientCommandResult<C["type"]>;
}
