export type SubagentErrorCode = "invalid_request" | "access_denied" | "not_running";

export class SubagentError extends Error {
  constructor(readonly code: SubagentErrorCode, message: string) {
    super(message);
    this.name = "SubagentError";
  }
}

export function subagentErrorStatus(error: unknown): number {
  if (!(error instanceof SubagentError)) return 500;
  switch (error.code) {
    case "invalid_request": return 400;
    case "access_denied": return 403;
    case "not_running": return 409;
  }
}

/** Only malformed HTTP request JSON is a client error; storage parse failures are operational. */
export async function readSubagentRequestJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch (error) {
    if (error instanceof SyntaxError) throw new SubagentError("invalid_request", "Invalid JSON request body");
    throw error;
  }
}
