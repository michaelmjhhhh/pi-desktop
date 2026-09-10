"use client";

import { createPortal } from "react-dom";
import { ProviderIcon } from "./ProviderIcon";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useIsMobile } from "@/hooks/useIsMobile";

export interface ModelSelectorOption {
  provider: string;
  modelId: string;
  name: string;
}

interface ModelSelectorProps {
  options: ModelSelectorOption[];
  value?: { provider: string; modelId: string } | null;
  onChange: (provider: string, modelId: string) => void;
  onClear?: () => void;
  emptyLabel?: string;
  selectedLabel?: string;
  disabled?: boolean;
  busy?: boolean;
  isAutoSelection?: boolean;
  ariaLabel?: string;
  variant?: "toolbar" | "field";
  placement?: "up" | "auto";
}

const providerLabel = (provider: string) => ({ "openai-codex": "Codex", openai: "OpenAI", deepseek: "DeepSeek", xai: "xAI", anthropic: "Anthropic", google: "Google" })[provider] ?? provider;
const FAVORITES_KEY = "pi-model-favorites";
const modelKey = (option: { provider: string; modelId: string }) => JSON.stringify([option.provider, option.modelId]);
function readFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}
const MODEL_OPTION_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareModelOptions(a: ModelSelectorOption, b: ModelSelectorOption): number {
  return MODEL_OPTION_COLLATOR.compare(a.name || a.modelId, b.name || b.modelId)
    || MODEL_OPTION_COLLATOR.compare(a.provider, b.provider)
    || MODEL_OPTION_COLLATOR.compare(a.modelId, b.modelId);
}

export function filterModelOptions(options: ModelSelectorOption[], query: string): ModelSelectorOption[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return options;

  return options.filter((option) => (
    `${option.name} ${option.modelId}`
      .toLocaleLowerCase()
      .includes(normalizedQuery)
  ));
}

export function ModelSelector({
  options,
  value,
  onChange,
  onClear,
  emptyLabel,
  selectedLabel,
  disabled = false,
  busy = false,
  isAutoSelection = false,
  ariaLabel,
  variant = "toolbar",
  placement = "up",
}: ModelSelectorProps) {
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<{ top: number; right: number; bottom: number; left: number; width: number } | null>(null);
  const [filter, setFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const providers = [...new Set(options.map((option) => option.provider))];
  const toggleFavorite = (option: ModelSelectorOption) => {
    const key = modelKey(option);
    const current = readFavorites();
    const next = current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
    if (providerFilter === "favorites" && current.includes(key)) panelRef.current?.querySelector("input")?.focus();
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Selection remains available without storage. */ }
  };
  const locked = disabled || busy;
  const sortedOptions = useMemo(() => [...options].sort(compareModelOptions), [options]);
  const filteredOptions = filterModelOptions(sortedOptions, filter).filter((option) => (
    providerFilter === "all" || (providerFilter === "favorites" ? favorites.includes(modelKey(option)) : option.provider === providerFilter)
  ));

  const visibleOptions = [...filteredOptions].sort((a, b) => {
    const rank = (option: ModelSelectorOption) => option.provider === value?.provider && option.modelId === value?.modelId
      ? 2 : favorites.includes(modelKey(option)) ? 1 : 0;
    return rank(b) - rank(a);
  });

  const currentName = selectedLabel ?? (value
    ? sortedOptions.find((option) => option.modelId === value.modelId && option.provider === value.provider)?.name ?? value.modelId
    : emptyLabel ?? (sortedOptions.length > 0 ? "Select model" : "No models"));

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        rootRef.current && !rootRef.current.contains(event.target as Node)
        && panelRef.current && !panelRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setFilter("");
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!locked) return;
    setOpen(false);
    setFilter("");
  }, [locked]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setFilter("");
      rootRef.current?.querySelector("button")?.focus();
    };
    document.addEventListener("keydown", handleEscape, true);
    const updateAnchor = () => {
      const rect = rootRef.current?.querySelector("button")?.getBoundingClientRect();
      if (rect) setAnchorRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width });
    };
    const handleScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) updateAnchor();
    };
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", handleScroll, true);
    window.visualViewport?.addEventListener("resize", updateAnchor);
    return () => {
      document.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", handleScroll, true);
      window.visualViewport?.removeEventListener("resize", updateAnchor);
    };
  }, [open]);

  const buttonStyle: CSSProperties = variant === "field"
    ? {
        display: "flex",
        alignItems: "center",
        gap: 7,
        width: "100%",
        minWidth: 0,
        height: 34,
        padding: "0 9px",
        overflow: "hidden",
        border: "1px solid var(--border)",
        borderRadius: 5,
        background: locked ? "var(--bg-panel)" : "var(--bg)",
        color: locked ? "var(--text-dim)" : "var(--text)",
        cursor: locked ? "default" : "pointer",
        fontSize: 12,
        textAlign: "left",
      }
    : {
        display: "flex",
        alignItems: "center",
        justifyContent: isMobile ? "flex-start" : undefined,
        gap: 6,
        width: isMobile ? "100%" : undefined,
        maxWidth: isMobile ? "100%" : 220,
        height: 32,
        padding: isMobile ? "8px 10px" : "8px 12px",
        overflow: "hidden",
        border: "none",
        borderRadius: 9,
        background: open ? "var(--bg-hover)" : "none",
        color: "var(--text-muted)",
        cursor: locked ? "not-allowed" : "pointer",
        fontSize: 12,
        opacity: locked ? 0.5 : 1,
        transition: "background 0.12s, color 0.12s",
      };

  const choose = (option: ModelSelectorOption) => {
    const active = option.modelId === value?.modelId && option.provider === value?.provider;
    setOpen(false);
    setFilter("");
    rootRef.current?.querySelector("button")?.focus();
    if (!active || isAutoSelection) onChange(option.provider, option.modelId);
  };

  return (
    <div
      ref={rootRef}
      className={`model-selector is-${variant}${locked ? " is-disabled" : ""}`}
      style={{ position: "relative", width: variant === "field" || isMobile ? "100%" : undefined, minWidth: 0, flex: variant === "toolbar" && isMobile ? "1 1 auto" : undefined }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        event.stopPropagation();
        setFilter("");
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-busy={busy || undefined}
        disabled={locked}
        title={busy ? "Switching model" : locked ? currentName : sortedOptions.length > 0 || onClear ? "Change model" : "No available models"}
        style={buttonStyle}
        onClick={(event) => {
          setFavorites(readFavorites());
          setProviderFilter("all");
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchorRect({ top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width });
          setOpen((current) => {
            if (current) setFilter("");
            return !current;
          });
        }}
        onMouseEnter={(event) => {
          if (locked) return;
          event.currentTarget.style.background = "var(--bg-hover)";
          event.currentTarget.style.color = "var(--text)";
        }}
        onMouseLeave={(event) => {
          if (locked) {
            event.currentTarget.style.background = variant === "field" ? "var(--bg-panel)" : "none";
            event.currentTarget.style.color = variant === "field" ? "var(--text-dim)" : "var(--text-muted)";
            return;
          }
          event.currentTarget.style.background = open ? "var(--bg-hover)" : variant === "field" ? "var(--bg)" : "none";
          event.currentTarget.style.color = variant === "field" ? "var(--text)" : "var(--text-muted)";
        }}
      >
        {busy ? (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }} aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          </svg>
        ) : (
          <ProviderIcon id={value?.provider ?? ""} size={16} />
        )}
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName}</span>
        {(
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: "var(--text-dim)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {open && anchorRect && (() => {
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
        const spaceAbove = anchorRect.top - 14;
        const spaceBelow = viewportHeight - anchorRect.bottom - 14;
        const openAbove = placement === "up" ? spaceAbove >= 220 || spaceAbove > spaceBelow : spaceAbove > spaceBelow;
        const maxHeight = Math.max(100, Math.min(openAbove ? spaceAbove : spaceBelow, 540));
        const width = Math.min(460, viewportWidth - 16);
        const verticalPosition = openAbove
          ? { bottom: viewportHeight - anchorRect.top + 6 }
          : { top: anchorRect.bottom + 6 };

        return createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t("modelPicker.title")}
            className="model-picker"
            style={{ position: "fixed", ...verticalPosition, left: Math.max(8, Math.min(anchorRect.left, viewportWidth - width - 8)), width, maxHeight, zIndex: 1500 }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setFilter("");
                rootRef.current?.querySelector("button")?.focus();
              }
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                const choices = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-model-choice]") ?? [])];
                if (!choices.length) return;
                event.preventDefault();
                const index = choices.indexOf(document.activeElement as HTMLButtonElement);
                choices[(index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length]?.focus();
              }
            }}
          >
            <nav className="model-picker-providers" aria-label={t("modelPicker.providers")}>
              <button type="button" title={t("modelPicker.all")} aria-label={t("modelPicker.all")} aria-pressed={providerFilter === "all"} onClick={() => setProviderFilter("all")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
              </button>
              <button type="button" title={t("modelPicker.favorites")} aria-label={t("modelPicker.favorites")} aria-pressed={providerFilter === "favorites"} onClick={() => setProviderFilter("favorites")}><FavoriteIcon filled /></button>
              <div className="model-picker-provider-divider" />
              {providers.map((provider) => <button key={provider} type="button" title={providerLabel(provider)} aria-label={providerLabel(provider)} aria-pressed={providerFilter === provider} onClick={() => setProviderFilter(provider)}><ProviderIcon id={provider} size={22} /></button>)}
            </nav>
            <div className="model-picker-main">
              <div className="model-picker-search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("chat.filterModels")} aria-label={t("chat.filterModels")} autoFocus autoComplete="off" spellCheck={false} />
              </div>
              <div className="model-picker-heading"><span>{providerFilter === "all" ? t("modelPicker.all") : providerFilter === "favorites" ? t("modelPicker.favorites") : providerLabel(providerFilter)}</span><span>{filteredOptions.length}</span></div>
              <div className="model-picker-list">
                {onClear && !filter.trim() && providerFilter === "all" && (
                  <button type="button" className="model-picker-default" data-model-choice aria-pressed={!value} onClick={() => { setOpen(false); setFilter(""); onClear(); rootRef.current?.querySelector("button")?.focus(); }}>{emptyLabel ?? "Default"}</button>
                )}
                {filteredOptions.length === 0 && <div className="model-picker-empty">{providerFilter === "favorites" && !filter.trim() ? t("modelPicker.noFavorites") : t("chat.noMatchingModels")}</div>}
                {visibleOptions.map((option) => {
                  const active = option.modelId === value?.modelId && option.provider === value?.provider;
                  const favorite = favorites.includes(modelKey(option));
                  return <div key={modelKey(option)} className="model-picker-row" data-active={active}>
                    <button type="button" className="model-picker-choice" data-model-choice aria-pressed={active} onClick={() => choose(option)}>
                      <span className="model-picker-name">{option.name || option.modelId}</span>
                      <span className="model-picker-provider"><ProviderIcon id={option.provider} size={15} />{providerLabel(option.provider)}</span>
                    </button>
                    {active && <span className="model-picker-selected" aria-label={t("modelPicker.selected")}>✓</span>}
                    <button type="button" className="model-picker-favorite" aria-label={t(favorite ? "modelPicker.unpin" : "modelPicker.pin", { model: `${option.name || option.modelId} (${providerLabel(option.provider)})` })} aria-pressed={favorite} onClick={() => toggleFavorite(option)}><FavoriteIcon filled={favorite} /></button>
                  </div>;
                })}
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}

function FavoriteIcon({ filled = false }: { filled?: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" /></svg>;
}
