"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { THEME_OPTIONS } from "@/lib/theme";
import { ThemeIcon } from "./ThemeIcon";
import {
  CHAT_CONTENT_WIDTH_DEFAULT,
  CHAT_CONTENT_WIDTH_MAX,
  CHAT_CONTENT_WIDTH_MIN,
  CHAT_CONTENT_FONT_SIZE_DEFAULT,
  CHAT_CONTENT_FONT_SIZE_MAX,
  CHAT_CONTENT_FONT_SIZE_MIN,
  useChatAppearance,
} from "@/hooks/useChatAppearance";
import { sendAgentCommand } from "@/lib/agent-client";
import type { ShellToolSettingsResponse } from "@/lib/api-types";
import {
  setLastSettingsSection,
  type SettingsSection,
} from "@/lib/settings-navigation";
import {
  isThinkingExpandedByDefault,
  setThinkingExpandedByDefault,
} from "@/lib/thinking-expansion-preference";
import { ModelsConfig } from "./ModelsConfig";
import { SkillsConfig } from "./SkillsConfig";
import { AgentsConfig } from "./AgentsConfig";
import { PluginsConfig } from "./PluginsConfig";
import { ConfigButton, ConfigSwitch } from "./SettingsUi";

interface Props {
  cwd: string | null;
  sessionId: string | null;
  initialSection: SettingsSection;
  onClose: () => void;
  onSessionReloaded: () => void;
  quoteSelectionEnabled: boolean;
  onQuoteSelectionChange: (enabled: boolean) => void;
}

export function SettingsSectionIcon({ section, size = 16, strokeWidth = 1.8 }: { section: SettingsSection; size?: number; strokeWidth?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "settings-section-icon",
  };

  if (section === "general") return <svg {...common}><path d="M20 7h-9M14 17H5" /><circle cx="7" cy="7" r="3" /><circle cx="17" cy="17" r="3" /></svg>;
  if (section === "models") return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 15h3M1 9h3M1 15h3" /></svg>;
  if (section === "skills") return <svg {...common}><path d="m12 2-10 5 10 5 10-5-10-5Z" /><path d="m2 12 10 5 10-5M2 17l10 5 10-5" /></svg>;
  if (section === "agents") return <svg {...common} className="settings-section-icon is-agent"><rect x="5" y="7" width="14" height="11" rx="2" /><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4" /></svg>;
  return <svg {...common}><path d="M9 7V2M15 7V2M6 13V8a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v5a6 6 0 0 1-12 0ZM12 19v3" /></svg>;
}

function GeneralSettings({ sessionId, onSessionReloaded, quoteSelectionEnabled, onQuoteSelectionChange }: Pick<Props, "sessionId" | "onSessionReloaded" | "quoteSelectionEnabled" | "onQuoteSelectionChange">) {
  const { locale, setLocale, supportedLocales, t } = useI18n();
  const { preference, setThemePreference } = useTheme();
  const { width: chatContentWidth, setWidth: setChatContentWidth, fontSize, setFontSize } = useChatAppearance();
  const [shellSettings, setShellSettings] = useState<ShellToolSettingsResponse | null>(null);
  const [shellSaving, setShellSaving] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  useEffect(() => {
    setThinkingExpanded(isThinkingExpandedByDefault());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/tools/settings")
      .then(async (response) => {
        const data = await response.json() as ShellToolSettingsResponse & { error?: string };
        if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
        if (!cancelled) setShellSettings(data);
      })
      .catch((cause) => {
        if (!cancelled) setShellError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => { cancelled = true; };
  }, []);

  const togglePowerShell = async (enabled: boolean) => {
    setShellSaving(true);
    setShellError(null);
    try {
      const response = await fetch("/api/tools/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json() as ShellToolSettingsResponse & { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? `HTTP ${response.status}`);
      setShellSettings(data);
      if (sessionId) {
        await sendAgentCommand(sessionId, { type: "reload" });
        onSessionReloaded();
      }
    } catch (cause) {
      setShellError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setShellSaving(false);
    }
  };

  return (
    <div className="settings-general">
      <header className="settings-general-header">
        <h2 className="settings-general-title">{t("settings.general")}</h2>
        <p className="settings-general-description">{t("settings.generalDescription")}</p>
      </header>

      <section className="settings-general-section" aria-labelledby="settings-appearance-heading">
        <h3 id="settings-appearance-heading" className="settings-general-heading">{t("settings.appearance")}</h3>
        <p className="settings-general-description">{t("settings.appearanceDescription")}</p>
        <div role="radiogroup" aria-label={t("settings.appearance")} className="settings-theme-options">
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.id;
            return (
              <label
                key={option.id}
                className="settings-theme-option"
              >
                <input
                  type="radio"
                  name="theme"
                  value={option.id}
                  checked={selected}
                  onChange={() => setThemePreference(option.id)}
                  className="sr-only"
                />
                <span className="settings-theme-preview" data-theme={option.id} aria-hidden="true">
                  <span className="settings-theme-preview-sidebar"><i /><i /><i /></span>
                  <span className="settings-theme-preview-chat"><i /><i /><i /><span /></span>
                </span>
                <span className="settings-theme-option-caption">
                  <ThemeIcon preference={option.id} size={15} />
                  <span className="settings-theme-option-label">{t(option.label)}</span>
                  <span className="settings-theme-selected" aria-hidden="true">
                    {selected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <div className="settings-preference-row settings-language-row">
          <div className="settings-preference-copy">
            <label htmlFor="settings-language">{t("common.language")}</label>
            <p className="settings-general-description">{t("settings.languageDescription")}</p>
          </div>
          <select
            id="settings-language"
            value={locale}
            onChange={(event) => setLocale(event.target.value as typeof locale)}
            className="settings-language-select"
          >
            {supportedLocales.map((plugin) => <option key={plugin.id} value={plugin.id}>{plugin.label}</option>)}
          </select>
        </div>
      </section>

      <section className="settings-general-section" aria-labelledby="settings-chat-heading">
        <h3 id="settings-chat-heading" className="settings-general-heading">{t("settings.chat")}</h3>
        <p className="settings-general-description">{t("settings.chatDescription")}</p>
        <div className="settings-chat-options">
          <div className="settings-chat-option settings-chat-range-option">
            <div className="settings-preference-copy">
              <label htmlFor="settings-chat-content-width">{t("settings.chatContentWidth")}</label>
              <p className="settings-general-description">{t("settings.chatContentWidthDescription")}</p>
            </div>
            <div className="settings-chat-range-control">
              <div className="settings-chat-range-header">
                <output htmlFor="settings-chat-content-width">{chatContentWidth}px</output>
                <ConfigButton
                  variant="ghost"
                  size="small"
                  className="settings-chat-reset"
                  title={t("settings.resetChatContentWidth")}
                  aria-label={t("settings.resetChatContentWidth")}
                  disabled={chatContentWidth === CHAT_CONTENT_WIDTH_DEFAULT}
                  onClick={() => setChatContentWidth(CHAT_CONTENT_WIDTH_DEFAULT)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
                  </svg>
                </ConfigButton>
              </div>
              <input
                id="settings-chat-content-width"
                type="range"
                min={CHAT_CONTENT_WIDTH_MIN}
                max={CHAT_CONTENT_WIDTH_MAX}
                step={10}
                value={chatContentWidth}
                onChange={(event) => setChatContentWidth(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="settings-chat-option settings-chat-range-option">
            <div className="settings-preference-copy">
              <label htmlFor="settings-chat-content-font-size">{t("settings.chatContentFontSize")}</label>
              <p className="settings-general-description">{t("settings.chatContentFontSizeDescription")}</p>
            </div>
            <div className="settings-chat-range-control">
              <div className="settings-chat-range-header">
                <output htmlFor="settings-chat-content-font-size">{fontSize}px</output>
                <ConfigButton
                  variant="ghost"
                  size="small"
                  className="settings-chat-reset"
                  title={t("settings.resetChatContentFontSize")}
                  aria-label={t("settings.resetChatContentFontSize")}
                  disabled={fontSize === CHAT_CONTENT_FONT_SIZE_DEFAULT}
                  onClick={() => setFontSize(CHAT_CONTENT_FONT_SIZE_DEFAULT)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5" />
                  </svg>
                </ConfigButton>
              </div>
              <input
                id="settings-chat-content-font-size"
                type="range"
                min={CHAT_CONTENT_FONT_SIZE_MIN}
                max={CHAT_CONTENT_FONT_SIZE_MAX}
                step={1}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
              />
            </div>
          </div>
          <div className="settings-chat-option settings-chat-switch-option">
            <div className="settings-preference-copy">
              <span>{t("settings.thinkingExpandedDefault")}</span>
              <p className="settings-general-description">{t("settings.thinkingDisplayDescription")}</p>
            </div>
            <ConfigSwitch
              checked={thinkingExpanded}
              label={t("settings.thinkingExpandedDefault")}
              onChange={(enabled) => {
                setThinkingExpandedByDefault(enabled);
                setThinkingExpanded(enabled);
              }}
            />
          </div>
          <div className="settings-chat-option settings-chat-switch-option">
            <div className="settings-preference-copy">
              <span>{t("settings.quoteSelection")}</span>
              <p className="settings-general-description">{t("settings.quoteSelectionDescription")}</p>
            </div>
            <ConfigSwitch
              checked={quoteSelectionEnabled}
              label={t("settings.quoteSelection")}
              onChange={onQuoteSelectionChange}
            />
          </div>
        </div>
      </section>

      {shellSettings?.isWindows && (
        <section className="settings-general-section" aria-labelledby="settings-shell-heading">
          <h3 id="settings-shell-heading" className="settings-general-heading">{t("settings.shellTool")}</h3>
          <p className="settings-general-description">{t("settings.shellToolDescription")}</p>
          <div className="settings-shell-option">
            <span>{t("settings.usePowerShell")}</span>
            <ConfigSwitch
              checked={shellSettings.powerShellEnabled}
              loading={shellSaving}
              label={t("settings.usePowerShell")}
              onChange={(enabled) => void togglePowerShell(enabled)}
            />
          </div>
          {shellError && <p role="alert" className="settings-general-error">{shellError}</p>}
        </section>
      )}
    </div>
  );
}

export function SettingsPanel({ cwd, sessionId, initialSection, onClose, onSessionReloaded, quoteSelectionEnabled, onQuoteSelectionChange }: Props) {
  const { t } = useI18n();
  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [mountedSections, setMountedSections] = useState<ReadonlySet<SettingsSection>>(
    () => new Set([section]),
  );
  const sections: { id: SettingsSection; label: string; requiresProject: boolean }[] = [
    { id: "general", label: t("settings.general"), requiresProject: false },
    { id: "models", label: t("common.models"), requiresProject: false },
    { id: "skills", label: t("common.skills"), requiresProject: true },
    { id: "agents", label: t("common.agents"), requiresProject: true },
    { id: "plugins", label: t("common.plugins"), requiresProject: true },
  ];

  useEffect(() => setLastSettingsSection(initialSection), [initialSection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (cwd || (section !== "skills" && section !== "agents" && section !== "plugins")) return;
    setSection("general");
    setMountedSections((current) => new Set(current).add("general"));
    setLastSettingsSection("general");
  }, [cwd, section]);

  const activateSection = (nextSection: SettingsSection) => {
    setMountedSections((current) => new Set(current).add(nextSection));
    setSection(nextSection);
    setLastSettingsSection(nextSection);
  };

  const sectionHost = (id: SettingsSection, content: ReactNode) => mountedSections.has(id) ? (
    <div
      key={id}
      hidden={section !== id}
      className="settings-section-host"
    >
      {content}
    </div>
  ) : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.title")}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      className="settings-dialog-backdrop"
    >
      <div className="settings-dialog-surface" data-section={section}>
        <div className="settings-dialog-header">
          <strong className="settings-dialog-title">{t("settings.title")}</strong>
          <select
            aria-label={t("settings.title")}
            value={section}
            onChange={(event) => activateSection(event.target.value as SettingsSection)}
            className="settings-mobile-section-picker"
          >
            {sections.map((item) => (
              <option key={item.id} value={item.id} disabled={item.requiresProject && !cwd}>
                {item.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={onClose} title={t("i18n.close")} aria-label={t("i18n.close")} className="config-close-button settings-dialog-close">×</button>
        </div>

        <div className="settings-dialog-body">
          <nav aria-label={t("settings.title")} className="settings-navigation">
            {[false, true].map((requiresProject) => (
              <div key={String(requiresProject)} className="settings-navigation-group">
                <p className="settings-navigation-label">{t(requiresProject ? "settings.project" : "settings.application")}</p>
                {sections.filter((item) => item.requiresProject === requiresProject).map((item) => {
                  const selected = section === item.id;
                  const disabled = item.requiresProject && !cwd;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="settings-navigation-item"
                      disabled={disabled}
                      title={disabled ? t("settings.projectRequired") : item.label}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => activateSection(item.id)}
                    >
                      <SettingsSectionIcon section={item.id} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                {requiresProject && !cwd && <p className="settings-navigation-hint">{t("settings.projectRequired")}</p>}
              </div>
            ))}
          </nav>

          <main className="settings-dialog-main">
            {sectionHost("general", <GeneralSettings sessionId={sessionId} onSessionReloaded={onSessionReloaded} quoteSelectionEnabled={quoteSelectionEnabled} onQuoteSelectionChange={onQuoteSelectionChange} />)}
            {sectionHost("models", <ModelsConfig embedded onClose={onClose} />)}
            {cwd && sectionHost("skills", <SkillsConfig embedded key={cwd} cwd={cwd} onClose={onClose} />)}
            {cwd && sectionHost("agents", <AgentsConfig embedded key={cwd} cwd={cwd} sessionId={sessionId} onClose={onClose} onReloaded={onSessionReloaded} />)}
            {cwd && sectionHost("plugins", <PluginsConfig embedded key={cwd} cwd={cwd} sessionId={sessionId} onClose={onClose} onReloaded={onSessionReloaded} />)}
          </main>
        </div>
      </div>
    </div>
  );
}
