import { useEffect, useState } from "react";

/** The localStorage key the theme choice is kept under; `root.tsx` reads it before hydration. */
export const THEME_STORAGE_KEY = "cadence-theme";

/** Whether the page is in dark mode, and a toggle that flips and remembers it. */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {}
  }

  return { isDark, toggleDarkMode };
}
