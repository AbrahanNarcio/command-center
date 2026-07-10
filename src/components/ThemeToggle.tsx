"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

/** Conmuta entre tema oscuro (por defecto) y claro; persiste en localStorage. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme");
    setTheme(t === "light" ? "light" : "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    // Transición suave solo durante el cambio, no en cada interacción.
    root.classList.add("theme-anim");
    if (next === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* modo privado sin storage: el tema no se recuerda, pero cambia igual. */
    }
    setTheme(next);
    window.setTimeout(() => root.classList.remove("theme-anim"), 400);
  };

  return (
    <button
      className="button small"
      style={{ marginTop: 7, width: "100%" }}
      onClick={toggle}
      title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
    >
      {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
    </button>
  );
}
