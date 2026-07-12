/** Traduce los mensajes de error de Supabase Auth (llegan en inglés) al español
 *  neutro de la app. Lo que no se reconoce cae a un mensaje genérico en español:
 *  el usuario NUNCA ve texto en inglés (invariante de idioma). */
export function authErrorEs(message: string | undefined | null): string {
  const m = (message || "").toLowerCase();
  if (!m) return "No se pudo completar. Inténtalo de nuevo.";
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed")) return "Tu correo aún no está confirmado. Revisa tu bandeja.";
  if (m.includes("for security purposes")) return "Por seguridad, espera un momento antes de volver a intentarlo.";
  if (m.includes("rate limit") || m.includes("too many requests")) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  if (m.includes("should be different from the old password")) return "La contraseña nueva debe ser diferente a la actual.";
  if (m.includes("password should be at least")) return "La contraseña es demasiado corta.";
  if (m.includes("expired") || m.includes("invalid token") || m.includes("otp")) return "El enlace expiró o ya se usó. Pide uno nuevo desde el inicio de sesión.";
  if (m.includes("already been registered") || m.includes("already registered") || m.includes("already exists"))
    return "Ese correo ya tiene un acceso registrado.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "El email no es válido.";
  if (m.includes("network") || m.includes("fetch")) return "Sin conexión con el servidor. Revisa tu internet.";
  return "No se pudo completar. Inténtalo de nuevo.";
}
