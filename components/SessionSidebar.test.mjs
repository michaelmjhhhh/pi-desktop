import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { getSessionListIndices } = await jiti.import("./SessionSidebar.tsx");

test("scrolling keeps the focused session and the viewport mounted without expanding the whole window", () => {
  for (const [scrollTop, focusedIndex] of [[0, 1999], [10000, 0]]) {
    const indices = getSessionListIndices(2000, scrollTop, 335, focusedIndex);
    const firstVisible = Math.floor(scrollTop / 44);
    const lastVisible = Math.ceil((scrollTop + 335) / 44) - 1;
    for (let index = firstVisible; index <= lastVisible; index++) assert.ok(indices.includes(index));
    assert.ok(indices.includes(focusedIndex));
    assert.ok(indices.length < 2000);
    assert.ok(indices.every((index) => index >= 0 && index < 2000));
    assert.equal(new Set(indices).size, indices.length);
    assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  }
  assert.ok(getSessionListIndices(2000, 0, 335, 3).includes(3));
  const blurred = getSessionListIndices(2000, 10000, 335);
  assert.ok(blurred.length > 0 && blurred.length < 2000);
  assert.ok(!blurred.includes(0));
  assert.deepEqual(blurred, getSessionListIndices(20000, 10000, 335));
});

test("session windows stay valid after a project shrinks and before the viewport is measured", () => {
  assert.deepEqual(getSessionListIndices(5, 80000, 335, 1999), [0, 1, 2, 3, 4]);
  assert.deepEqual(getSessionListIndices(0, 80000, 335, 1999), []);
  const unmeasured = getSessionListIndices(2000, 0, 0);
  assert.ok(unmeasured.length > 0 && unmeasured.length < 2000);
  assert.ok(unmeasured.every((index) => index >= 0 && index < 2000));
  assert.equal(new Set(unmeasured).size, unmeasured.length);
});
