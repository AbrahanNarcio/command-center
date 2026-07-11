import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidad · Content OS",
  description:
    "Política de privacidad de Content OS: qué datos de Instagram tratamos, con qué fin, cómo los protegemos y cómo solicitar su eliminación.",
  robots: { index: true, follow: true },
};

const CONTACT = "abrahannarcio@gmail.com";
const UPDATED = "11 de julio de 2026";

export default function PrivacidadPage() {
  return (
    <main className="legal">
      <div className="legal-inner">
        <p className="legal-eyebrow">Content OS</p>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: {UPDATED}</p>

        <section>
          <h2>1. Quiénes somos y qué es Content OS</h2>
          <p>
            Content OS es una aplicación privada de gestión y análisis de contenido para cuentas
            profesionales (empresa o creador) de Instagram. Permite al titular de una cuenta, y a las
            personas que él autorice, visualizar métricas, organizar publicaciones y llevar el
            seguimiento de su contenido. La aplicación se conecta a Instagram únicamente a través de
            la API oficial de Meta (Instagram Graph API), con el permiso explícito del titular de la
            cuenta.
          </p>
        </section>

        <section>
          <h2>2. Qué información tratamos</h2>
          <ul>
            <li>
              <strong>Datos de acceso a la aplicación:</strong> el correo electrónico con el que se
              crea el usuario para iniciar sesión. La contraseña se gestiona de forma cifrada por
              nuestro proveedor de autenticación y nunca la almacenamos en texto claro.
            </li>
            <li>
              <strong>Datos de la cuenta de Instagram conectada:</strong> al autorizar la conexión,
              obtenemos de la API oficial de Meta información de la cuenta profesional: identificador
              y nombre de usuario, foto de perfil, número de seguidores, y las métricas e
              interacciones de las publicaciones (vistas, alcance, me gusta, comentarios, guardados,
              compartidos y estadísticas agregadas). Solo accedemos a la información de cuentas cuyos
              titulares han autorizado expresamente la conexión.
            </li>
            <li>
              <strong>Tokens de acceso de Instagram:</strong> se guardan cifrados y se usan solo para
              sincronizar las métricas desde los servidores de Meta. Nunca se envían al navegador ni a
              terceros.
            </li>
          </ul>
          <p>
            No solicitamos ni tratamos categorías especiales de datos personales, ni recopilamos
            información de personas distintas al titular de la cuenta y a los usuarios que él autoriza.
          </p>
        </section>

        <section>
          <h2>3. Con qué finalidad usamos los datos</h2>
          <ul>
            <li>Mostrar al titular y a sus usuarios autorizados el rendimiento de su propia cuenta.</li>
            <li>Generar reportes e históricos de métricas de la cuenta conectada.</li>
            <li>Permitir el inicio de sesión y la separación de datos entre cuentas.</li>
          </ul>
          <p>
            No usamos los datos con fines publicitarios, no elaboramos perfiles de terceros y no
            vendemos ni cedemos información a nadie.
          </p>
        </section>

        <section>
          <h2>4. Base y consentimiento</h2>
          <p>
            El tratamiento se realiza con el consentimiento del titular de la cuenta, otorgado al
            autorizar la conexión con Instagram, y para prestar el servicio que ha solicitado. El
            titular puede retirar ese consentimiento en cualquier momento desconectando su cuenta.
          </p>
        </section>

        <section>
          <h2>5. Cómo protegemos la información</h2>
          <ul>
            <li>Los tokens de acceso se almacenan cifrados (AES-256-GCM).</li>
            <li>El acceso a los datos ocurre solo desde el servidor; nunca se exponen credenciales en el navegador.</li>
            <li>Cada usuario solo puede ver los datos de la cuenta a la que está vinculado.</li>
            <li>La comunicación con la aplicación se realiza mediante conexiones cifradas (HTTPS).</li>
          </ul>
        </section>

        <section>
          <h2>6. Conservación de los datos</h2>
          <p>
            Conservamos la información mientras la cuenta esté conectada y el usuario mantenga acceso
            a la aplicación. Al desconectar la cuenta de Instagram se elimina el token de acceso y se
            detiene toda sincronización. Al eliminar una cuenta o un usuario se borran sus datos
            asociados, tal como se describe en el apartado siguiente.
          </p>
        </section>

        <section>
          <h2>7. Cómo eliminar tus datos</h2>
          <p>
            Puedes solicitar la eliminación de tus datos en cualquier momento. Desde la propia
            aplicación, desconectar la cuenta de Instagram elimina el token de acceso y detiene la
            sincronización. Para borrar por completo tu cuenta de usuario y todo su histórico,
            escríbenos a <a href={`mailto:${CONTACT}`}>{CONTACT}</a> o consulta la página de{" "}
            <a href="/eliminar-datos">eliminación de datos</a>. Atenderemos la solicitud en un plazo
            razonable.
          </p>
        </section>

        <section>
          <h2>8. Proveedores que nos dan servicio</h2>
          <p>
            Para operar utilizamos proveedores de infraestructura (alojamiento web y base de datos)
            que tratan los datos por cuenta nuestra y bajo obligaciones de confidencialidad, y la
            plataforma de Meta como origen de los datos de Instagram. No compartimos la información con
            terceros para sus propios fines.
          </p>
        </section>

        <section>
          <h2>9. Tus derechos</h2>
          <p>
            Puedes solicitar el acceso, la rectificación o la eliminación de tus datos, así como
            retirar tu consentimiento, escribiéndonos a{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </section>

        <section>
          <h2>10. Cambios en esta política</h2>
          <p>
            Si actualizamos esta política, publicaremos la nueva versión en esta misma dirección y
            cambiaremos la fecha de última actualización.
          </p>
        </section>

        <section>
          <h2>11. Contacto</h2>
          <p>
            Para cualquier duda sobre esta política o sobre el tratamiento de tus datos, escríbenos a{" "}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
