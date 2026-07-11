import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminación de datos · Content OS",
  description:
    "Cómo eliminar tus datos de Content OS y revocar el acceso a tu cuenta de Instagram.",
  robots: { index: true, follow: true },
};

const CONTACT = "abrahannarcio@gmail.com";
const UPDATED = "11 de julio de 2026";

export default function EliminarDatosPage() {
  return (
    <main className="legal">
      <div className="legal-inner">
        <p className="legal-eyebrow">Content OS</p>
        <h1>Eliminación de datos</h1>
        <p className="legal-updated">Última actualización: {UPDATED}</p>

        <section>
          <p>
            En Content OS puedes eliminar tus datos y revocar el acceso a tu cuenta de Instagram en
            cualquier momento. Estas son las opciones:
          </p>
        </section>

        <section>
          <h2>1. Desconectar tu cuenta de Instagram</h2>
          <p>
            Dentro de la aplicación, en la sección <strong>Conexión IG</strong>, usa la opción de
            desconectar. Al hacerlo se elimina de inmediato el token de acceso guardado y se detiene
            toda sincronización con Instagram. También puedes revocar el permiso desde la
            configuración de aplicaciones de tu propia cuenta de Instagram/Facebook.
          </p>
        </section>

        <section>
          <h2>2. Eliminar por completo tu cuenta de usuario y tu histórico</h2>
          <p>
            Para borrar de forma definitiva tu usuario y todos los datos asociados (métricas,
            reportes e histórico de la cuenta), envía una solicitud a{" "}
            <a href={`mailto:${CONTACT}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos`}>
              {CONTACT}
            </a>{" "}
            desde el correo con el que iniciaste sesión, indicando el nombre de la cuenta de
            Instagram conectada. Procesaremos la eliminación y te confirmaremos cuando se haya
            completado, en un plazo razonable.
          </p>
        </section>

        <section>
          <h2>Qué se elimina</h2>
          <ul>
            <li>El token de acceso cifrado de Instagram.</li>
            <li>Las métricas, reportes e histórico sincronizados de la cuenta.</li>
            <li>Tu usuario de acceso a la aplicación.</li>
          </ul>
        </section>

        <section>
          <p>
            Consulta también nuestra <a href="/privacidad">política de privacidad</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
