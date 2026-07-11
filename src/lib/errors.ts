// Bus global de errores de API (mismo patrón que busy.ts). Cualquier mutación
// que falle lo reporta aquí y el StoreProvider lo convierte en un toast de
// error: ningún guardado falla en silencio.
type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function reportApiError(message: string) {
  for (const listener of listeners) listener(message);
}

/** Se suscribe a los errores de API. Devuelve la función para desuscribirse. */
export function onApiError(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
