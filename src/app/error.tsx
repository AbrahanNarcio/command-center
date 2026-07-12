"use client";

/** Pantalla de error fatal propia, en español (el default de Next sale en inglés).
 *  No muestra detalles técnicos al usuario; el error queda en la consola. */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <div className="loading-screen">
      <section className="panel" style={{ width: "min(480px, 92vw)", textAlign: "center" }}>
        <p className="eyebrow">Algo salió mal</p>
        <h2 style={{ marginBottom: 10 }}>La página tuvo un error</h2>
        <p style={{ color: "var(--soft)", lineHeight: 1.55 }}>
          Tus datos están a salvo. Vuelve a intentarlo; si sigue pasando, recarga la página.
        </p>
        <button className="button primary" style={{ marginTop: 6 }} onClick={reset}>
          Reintentar
        </button>
      </section>
    </div>
  );
}
