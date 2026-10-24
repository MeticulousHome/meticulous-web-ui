import { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";

// Keep in sync with the inline script in index.html, which applies the theme
// before the first paint.
const STORAGE_KEY = "meticulous:theme";

const systemDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

// Light is the default (the design is light-first); "system" follows the OS.
const readThemePreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "system" || stored === "dark") return stored;
  } catch {
    // Storage can be blocked; fall back to the default.
  }
  return "light";
};

const applyTheme = (preference: ThemePreference) => {
  const dark =
    preference === "dark" || (preference === "system" && systemDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  window.dispatchEvent(new Event("meticulous:theme"));
};

type ThemeContextValue = readonly [
  ThemePreference,
  (preference: ThemePreference) => void,
];

const ThemeContext = createContext<ThemeContextValue>(["light", () => {}]);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [preference, setPreference] =
    useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyTheme(preference);
    try {
      if (preference === "light") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Not persisted; the choice still applies to this visit.
    }
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return (
    <ThemeContext.Provider value={[preference, setPreference] as const}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useThemePreference = () => useContext(ThemeContext);

// The resolved theme, for code that needs concrete colors (charts).
// eslint-disable-next-line react-refresh/only-export-components
export const useResolvedTheme = () => {
  const read = () =>
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  const [theme, setTheme] = useState<"light" | "dark">(read);
  useEffect(() => {
    const onChange = () => setTheme(read());
    window.addEventListener("meticulous:theme", onChange);
    return () => window.removeEventListener("meticulous:theme", onChange);
  }, []);
  return theme;
};

// Reads the current value of a CSS custom property, e.g. cssVar("--s1").
// eslint-disable-next-line react-refresh/only-export-components
export const cssVar = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();
