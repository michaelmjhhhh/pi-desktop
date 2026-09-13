import { getRpcSession } from "./rpc-manager";
import type { AgentStateResponse, AgentStateSnapshot } from "./agent-state-types";

/** Read an existing runtime without starting or restoring an agent. */
export async function readAgentState(sessionId: string): Promise<AgentStateSnapshot> {
  const session = getRpcSession(sessionId);
  if (!session?.isAlive()) return { running: false };
  return { running: true, state: await session.send({ type: "get_state" }) as AgentStateResponse };
}
