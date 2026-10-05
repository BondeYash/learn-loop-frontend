import { createContext, useContext, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
const ThemeContext = createContext(null);
const key = "lessonloop_theme";
function initialTheme() {
  try { const saved = localStorage.getItem(key); if (["light", "dark"].includes(saved)) return saved; } catch { /* Use device preference when storage is unavailable. */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#191724" : "#FFF9EF");
    try { localStorage.setItem(key, theme); } catch { /* The in-memory preference still works. */ }
  }, [theme]);
  useEffect(() => {
    const changed = (event) => { if (event.key === key && ["light", "dark"].includes(event.newValue)) setTheme(event.newValue); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  const next = theme === "dark" ? "light" : "dark";
  return <button type="button" className="btn-secondary h-10 w-10 shrink-0 p-0" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => setTheme(next)}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}
