import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { THEME_INIT_SCRIPT, THEME_OPTIONS, isDarkTheme, isThemePreference, normalizeThemePreference } from "./theme.ts";

test("only light and dark are selectable", () => {
  assert.deepEqual(THEME_OPTIONS.map(({ id }) => id), ["light", "dark"]);
  for (const value of ["mist", "rose", "pine", "auto", null, "unknown"]) {
    assert.equal(isThemePreference(value), false);
  }
});

test("first paint and hydrated preferences migrate old palettes to light or dark", () => {
  for (const fallback of ["light", "dark"]) {
    for (const [stored, expected] of [
      ["light", "light"], ["dark", "dark"], ["mist", "light"], ["rose", "light"],
      ["pine", "dark"], ["auto", fallback], [null, fallback], ["", fallback], ["unknown", fallback],
    ]) {
      let persisted;
      const root = { dataset: {}, classList: { toggle: (name, value) => { root[name] = value; } } };
      runInNewContext(THEME_INIT_SCRIPT, {
        localStorage: { getItem: () => stored, setItem: (key, value) => { persisted = [key, value]; } },
        window: { matchMedia: () => ({ matches: fallback === "dark" }) },
        document: { documentElement: root },
      });
      assert.equal(root.dataset.theme, expected);
      assert.equal(root.dark, isDarkTheme(expected));
      assert.deepEqual(persisted, ["pi-theme", expected]);
      assert.equal(normalizeThemePreference(stored, fallback), expected);
    }
  }
});

test("first paint still applies a theme when storage reads or writes are blocked", () => {
  for (const blocked of ["getItem", "setItem"]) {
    const root = { dataset: {}, classList: { toggle() {} } };
    runInNewContext(THEME_INIT_SCRIPT, {
      localStorage: {
        getItem: () => { if (blocked === "getItem") throw new Error("Blocked"); return "pine"; },
        setItem: () => { throw new Error("Blocked"); },
      },
      window: { matchMedia: () => ({ matches: false }) },
      document: { documentElement: root },
    });
    assert.equal(root.dataset.theme, blocked === "getItem" ? "light" : "dark");
  }
});
