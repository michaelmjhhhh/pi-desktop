export const THEME_OPTIONS = [
  { id: "light", label: "settings.themeLight" },
  { id: "dark", label: "settings.themeDark" },
] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number]["id"];
export type ResolvedTheme = ThemePreference;

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_OPTIONS.some((option) => option.id === value);
}

export function isDarkTheme(theme: ResolvedTheme): boolean {
  return theme === "dark";
}

export function normalizeThemePreference(value: unknown, fallback: ThemePreference): ThemePreference {
  if (isThemePreference(value)) return value;
  if (value === "pine") return "dark";
  if (value === "mist" || value === "rose") return "light";
  return fallback;
}

// Migrate old palettes before first paint. The system scheme is only an initial default.
export const THEME_INIT_SCRIPT = `(function(){var t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";try{var s=localStorage.getItem("pi-theme");if(s==="dark"||s==="pine")t="dark";else if(s==="light"||s==="mist"||s==="rose")t="light";localStorage.setItem("pi-theme",t)}catch(e){}var r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",t==="dark")})();`;
