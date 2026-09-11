import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panelSource = await readFile(new URL("./SettingsPanel.tsx", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/settings.css", import.meta.url), "utf8");
const shellSource = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const sidebarSource = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
const themeSource = await readFile(new URL("../hooks/useTheme.ts", import.meta.url), "utf8");
const themeOptionsSource = await readFile(new URL("../lib/theme.ts", import.meta.url), "utf8");
const enSource = await readFile(new URL("../lib/i18n/messages/en.ts", import.meta.url), "utf8");
const zhSource = await readFile(new URL("../lib/i18n/messages/zh-CN.ts", import.meta.url), "utf8");

test("opens one settings panel from direct sidebar shortcuts", () => {
  assert.match(shellSource, /<SettingsPanel/);
  assert.match(shellSource, /setSettingsSection\(section\)/);
  assert.match(shellSource, /initialSection=\{settingsSection\}/);
  assert.match(shellSource, /translate\("common\.settings"\)/);
  assert.match(shellSource, /<SettingsSectionIcon section=\{section\} size=\{14\} strokeWidth=\{2\} \/>\s*<span>\{label\}<\/span>/);
  assert.match(shellSource, /<SettingsSectionIcon section="general" size=\{14\} strokeWidth=\{2\} \/>/);
  assert.doesNotMatch(shellSource, /\["plugins", translate\("common\.plugins"\)\]/);
  assert.doesNotMatch(shellSource, /setModelsConfigOpen|setSkillsConfigOpen|setAgentsConfigOpen|setPluginsConfigOpen/);
});

test("keeps every requested configuration surface inside the settings panel", () => {
  for (const section of ["general", "models", "skills", "agents", "plugins"]) {
    assert.match(panelSource, new RegExp(`id: "${section}"`));
  }
  for (const component of ["ModelsConfig", "SkillsConfig", "AgentsConfig", "PluginsConfig"]) {
    assert.match(panelSource, new RegExp(`<${component} embedded`));
  }
});

test("restores the settings section and each list detail selection", async () => {
  assert.match(shellSource, /getLastSettingsSection\(projectTrustCwd\)/);
  assert.match(panelSource, /setLastSettingsSection\(initialSection\)/);
  assert.match(panelSource, /setLastSettingsSection\(nextSection\)/);
  for (const name of ["ModelsConfig", "SkillsConfig", "AgentsConfig", "PluginsConfig"]) {
    assert.match(
      await readFile(new URL(`./${name}.tsx`, import.meta.url), "utf8"),
      /getLastSettingsSelection/,
    );
  }
});

test("keeps visited settings sections mounted and contains nested Escape handling", async () => {
  const modelsSource = await readFile(new URL("./ModelsConfig.tsx", import.meta.url), "utf8");
  assert.match(panelSource, /mountedSections\.has\(id\)/);
  assert.match(panelSource, /hidden=\{section !== id\}/);
  assert.match(panelSource, /event\.defaultPrevented/);
  assert.match(modelsSource, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*onClose\(\);/);
});

test("offers only light and dark themes with native radios", () => {
  for (const preference of ["light", "dark"]) {
    assert.match(themeOptionsSource, new RegExp(`id: "${preference}"`));
  }
  assert.doesNotMatch(themeOptionsSource, /id: "(?:mist|rose|pine|auto)"/);
  assert.match(panelSource, /THEME_OPTIONS\.map/);
  assert.match(panelSource, /type="radio"/);
  assert.match(panelSource, /setThemePreference\(option\.id\)/);
  assert.match(themeSource, /const setThemePreference = useCallback/);
});

test("groups chat layout and behavior controls together", () => {
  const appearanceSection = panelSource.slice(
    panelSource.indexOf('{t("settings.appearance")}'),
    panelSource.indexOf('{t("settings.chat")}'),
  );
  const chatSection = panelSource.slice(
    panelSource.indexOf('{t("settings.chat")}'),
    panelSource.indexOf("{shellSettings?.isWindows"),
  );

  assert.doesNotMatch(appearanceSection, /settings-chat-content/);
  assert.match(chatSection, /className="settings-chat-options"/);
  assert.equal((chatSection.match(/className="settings-chat-option(?: |")/g) ?? []).length, 4);
  assert.equal((chatSection.match(/<ConfigSwitch/g) ?? []).length, 2);
  for (const key of ["thinkingExpandedDefault", "chatContentWidth", "chatContentFontSize", "quoteSelection"]) {
    assert.match(chatSection, new RegExp(`t\\("settings\\.${key}"\\)`));
  }
  assert.doesNotMatch(panelSource, /ThinkingIcon|settings-thinking-/);
});

test("groups desktop navigation and keeps a compact mobile section picker", () => {
  assert.match(panelSource, /className="settings-mobile-section-picker"/);
  assert.match(panelSource, /className="settings-navigation"/);
  assert.match(panelSource, /settings.project" : "settings.application/);
  assert.match(panelSource, /disabled=\{disabled\}/);
  assert.match(panelSource, /aria-current=\{selected \? "page" : undefined\}/);
  assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*?\.settings-navigation \{[\s\S]*?display: none/);
  assert.match(cssSource, /@media \(max-width: 640px\)[\s\S]*?\.settings-mobile-section-picker \{[\s\S]*?display: block/);
  assert.match(panelSource, /<main className="settings-dialog-main">/);
});

test("labels agent profiles as sub-agents", () => {
  assert.match(enSource, /"common\.agents": "Sub-agents"/);
  assert.match(enSource, /"agents\.new": "New sub-agent"/);
  assert.match(zhSource, /"common\.agents": "子代理"/);
  assert.match(zhSource, /"agents\.new": "新建子代理"/);
});

test("uses the child-session robot glyph for the sub-agents tab", () => {
  const robotGlyph = /<rect x="5" y="7" width="14" height="11" rx="2" \/>\s*<path d="M9 11h\.01M15 11h\.01M9 15h6M12 7V4M10 4h4" \/>/;
  assert.match(panelSource, robotGlyph);
  assert.match(sidebarSource, robotGlyph);
  assert.match(panelSource, /section === "agents"[\s\S]*?className="settings-section-icon is-agent"/);
  assert.match(cssSource, /\.settings-section-icon\.is-agent \{[\s\S]*?transform: scale\(1\.25\)/);
});

test("uses the compact controls glyph for General", () => {
  assert.match(panelSource, /section === "general"[\s\S]*?<path d="M20 7h-9M14 17H5" \/>[\s\S]*?<circle cx="7" cy="7" r="3" \/>[\s\S]*?<circle cx="17" cy="17" r="3" \/>/);
});
