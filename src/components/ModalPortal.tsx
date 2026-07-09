"use client";

import { createPortal } from "react-dom";

/**
 * Renderiza los modales directo en document.body. Sin esto, cualquier ancestro
 * con animación/transform/backdrop-filter crea un contexto de apilamiento y el
 * hero (z-index 1) queda pintado encima del modal.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}
