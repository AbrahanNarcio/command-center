"use client";

import { useEffect, useState } from "react";
import { onBusy } from "@/lib/busy";

/** Barra delgada en el borde superior mientras hay peticiones en curso. */
export default function TopLoader() {
  const [busy, setBusy] = useState(false);
  useEffect(() => onBusy(setBusy), []);
  if (!busy) return null;
  return <div className="top-loader" role="progressbar" aria-label="Cargando" />;
}
