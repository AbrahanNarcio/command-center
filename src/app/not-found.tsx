import Link from "next/link";

/** 404 propio: el default de Next está en inglés (invariante: español neutro). */
export default function NotFound() {
  return (
    <div className="loading-screen">
      <section className="panel" style={{ width: "min(480px, 92vw)", textAlign: "center" }}>
        <p className="eyebrow">Error 404</p>
        <h2 style={{ marginBottom: 10 }}>Esta página no existe</h2>
        <p style={{ color: "var(--soft)", lineHeight: 1.55 }}>
          La dirección que abriste no corresponde a ninguna sección de Content OS.
        </p>
        <Link className="button primary" href="/" style={{ display: "inline-flex", marginTop: 6 }}>
          Ir al panel
        </Link>
      </section>
    </div>
  );
}
