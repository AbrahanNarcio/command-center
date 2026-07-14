"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Droplets, GlassWater, Moon, Sun } from "lucide-react";

type Theme = "dark" | "light" | "glass" | "aero";

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: "dark", label: "Oscuro", icon: <Moon size={14} /> },
  { id: "light", label: "Claro", icon: <Sun size={14} /> },
  { id: "glass", label: "Glass", icon: <GlassWater size={14} /> },
  { id: "aero", label: "Aero", icon: <Droplets size={14} /> },
];

/** Selector de tema: un botón con el tema activo que despliega la lista al
 *  hacer clic (antes eran 4 botones siempre visibles). Persiste en localStorage. */
export default function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" || t === "glass" || t === "aero" ? t : "dark");
  }, []);

  // Cierra al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    setOpen(false);
    window.setTimeout(() => root.classList.remove("theme-anim"), 400);
  };

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="theme-dd" ref={wrapRef}>
      <button
        type="button"
        className="theme-dd-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.icon}
        <span>Tema: {current.label}</span>
        <ChevronDown size={14} className={`theme-dd-chevron${open ? " open" : ""}`} />
      </button>
      {open && (
        <ul className="theme-dd-menu" role="listbox" aria-label="Elegir tema">
          {THEMES.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className={`theme-dd-item${theme === t.id ? " active" : ""}`}
                role="option"
                aria-selected={theme === t.id}
                onClick={() => pick(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
                {theme === t.id && <Check size={14} className="theme-dd-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
