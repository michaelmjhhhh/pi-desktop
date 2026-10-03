import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  moduleCache: false,
});
const { AgentCommandError, isPromptRejectedError, sendAgentCommand } = await jiti.import("./agent-client.ts");

test("agent command HTTP rejections are distinguishable from transport failures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response(
    JSON.stringify({
      error: "Authentication failed",
      code: "prompt_rejected",
      accepted: false,
    }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    sendAgentCommand("session-id", { type: "prompt", message: "hello" }),
    (error) => {
      assert.equal(error instanceof AgentCommandError, true);
      assert.equal(error.status, 500);
      assert.equal(error.message, "Authentication failed");
      assert.equal(error.code, "prompt_rejected");
      assert.equal(error.accepted, false);
      assert.equal(isPromptRejectedError(error), true);
      return true;
    },
  );

  const transportError = new TypeError("connection reset");
  globalThis.fetch = async () => {
    throw transportError;
  };

  await assert.rejects(
    sendAgentCommand("session-id", { type: "prompt", message: "hello" }),
    (error) => {
      assert.equal(error, transportError);
      assert.equal(error instanceof AgentCommandError, false);
      assert.equal(isPromptRejectedError(error), false);
      return true;
    },
  );
});

test("only an explicit negative prompt acknowledgement is definitive", () => {
  assert.equal(
    isPromptRejectedError(new AgentCommandError("proxy failure", 502)),
    false,
  );
  assert.equal(
    isPromptRejectedError(new AgentCommandError("generic API failure", 500, "internal_error", false)),
    false,
  );
});

test("command transport preserves requests and legitimate null results", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const command = { type: "prompt", message: "hello", toolNames: [] };
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/agent/session%2Fid");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), command);
    return Response.json({ success: true, data: null });
  };
  assert.equal(await sendAgentCommand("session/id", command), null);
  globalThis.fetch = async () => Response.json({ success: true, data: { sessionId: "session-id", recreated: true } });
  assert.deepEqual(await sendAgentCommand("session-id", { type: "set_tools", toolNames: [] }), {
    sessionId: "session-id", recreated: true,
  });
});

test("malformed successes remain ambiguous rather than claiming prompt rejection", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const body of [null, [], {}, { success: false, data: null }, { success: true }]) {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(sendAgentCommand("session-id", { type: "prompt", message: "hello" }), (error) => {
      assert.equal(error instanceof AgentCommandError, true);
      assert.equal(error.message, "Invalid agent command response");
      assert.equal(isPromptRejectedError(error), false);
      return true;
    });
  }
  globalThis.fetch = async () => new Response("proxy failure", { status: 502 });
  await assert.rejects(sendAgentCommand("session-id", { type: "prompt", message: "hello" }), (error) => {
    assert.equal(error.status, 502);
    assert.equal(error.message, "HTTP 502");
    assert.equal(isPromptRejectedError(error), false);
    return true;
  });
});
