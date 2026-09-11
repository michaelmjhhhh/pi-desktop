"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isDarkTheme, normalizeThemePreference, type ThemePreference, type ResolvedTheme } from "@/lib/theme";

export type { ThemePreference, ResolvedTheme } from "@/lib/theme";

type ThemeState = {
  preference: ThemePreference;
  theme: ResolvedTheme;
};

type ToggleOrigin = { x: number; y: number };

const STORAGE_KEY = "pi-theme";
const SERVER_SNAPSHOT: ThemeState = { preference: "light", theme: "light" };

const listeners = new Set<() => void>();
let state: ThemeState | null = null;

function emit(): void {
  listeners.forEach((cb) => cb());
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ThemePreference {
  const fallback = getSystemTheme();
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return normalizeThemePreference(value, fallback);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  return fallback;
}

function applyDomTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", isDarkTheme(theme));
}

function ensureState(): ThemeState {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (state) return state;

  const preference = readStoredPreference();
  const theme = preference;
  applyDomTheme(theme);
  state = { preference, theme };
  return state;
}

function setThemeState(preference: ThemePreference): void {
  applyDomTheme(preference);
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
  state = { preference, theme: preference };
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  ensureState();
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): ThemeState {
  return ensureState();
}

function getServerSnapshot(): ThemeState {
  return SERVER_SNAPSHOT;
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setThemePreference = useCallback((nextPreference: ThemePreference, origin?: ToggleOrigin) => {
    const current = ensureState();
    if (current.preference === nextPreference) return;
    const apply = () => {
      setThemeState(nextPreference);
    };

    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const supportsVT = typeof document.startViewTransition === "function";

    if (!supportsVT || reduceMotion) {
      apply();
      return;
    }

    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const transition = document.startViewTransition(apply);
    transition.ready
      .then(() => {
        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${endRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration: 450,
            easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {
        // transition cancelled — ignore
      });
  }, []);

  return {
    theme: snapshot.theme,
    preference: snapshot.preference,
    setThemePreference,
    isDark: isDarkTheme(snapshot.theme),
  };
}
