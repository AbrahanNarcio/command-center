// Contador global de peticiones en curso. Alimenta la barra de progreso
// superior: mientras haya al menos una, la barra corre.
type Listener = (busy: boolean) => void;

let count = 0;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(count > 0);
}

export async function trackBusy<T>(promise: Promise<T>): Promise<T> {
  count += 1;
  emit();
  try {
    return await promise;
  } finally {
    count = Math.max(0, count - 1);
    emit();
  }
}

/** Se suscribe al estado ocupado/libre. Devuelve la función para desuscribirse. */
export function onBusy(listener: Listener): () => void {
  listeners.add(listener);
  listener(count > 0);
  return () => {
    listeners.delete(listener);
  };
}
