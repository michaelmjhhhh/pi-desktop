import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const configUrl = new URL("../next.config.ts", import.meta.url);

test("resolves config paths without CommonJS globals", async () => {
  const config = await import(`${configUrl.href}?esm-test`);
  assert.equal(config.default.outputFileTracingRoot, path.resolve(fileURLToPath(new URL("..", import.meta.url))));
  assert.equal(typeof config.default.env.NEXT_PUBLIC_APP_VERSION, "string");
});
