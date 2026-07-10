"use client";

import { useEffect, useState } from "react";
import { GlassWater, Moon, Sun } from "lucide-react";

type Theme = "dark" | "light" | "glass";

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: "dark", label: "Oscuro", icon: <Moon size={13} /> },
  { id: "light", label: "Claro", icon: <Sun size={13} /> },
  { id: "glass", label: "Glass", icon: <GlassWater size={13} /> },
];

/** Selector de tema: oscuro (por defecto), claro o glassmorphism. Persiste en localStorage. */
export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" || t === "glass" ? t : "dark");
  }, []);

  const pick = (next: Theme) => {
    const root = document.documentElement;
    // Transición suave solo durante el cambio.
    root.classList.add("theme-anim");
    if (next === "dark") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* modo privado sin storage: el tema no se recuerda, pero cambia igual. */
    }
    setTheme(next);
    window.setTimeout(() => root.classList.remove("theme-anim"), 400);
  };

  return (
    <div className="theme-seg" role="group" aria-label="Tema">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-seg-btn${theme === t.id ? " active" : ""}`}
          onClick={() => pick(t.id)}
          title={`Tema ${t.label.toLowerCase()}`}
          aria-pressed={theme === t.id}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
