/**
 * Generador de contraseñas fuertes usando el CSPRNG del navegador
 * (crypto.getRandomValues, no Math.random). Garantiza al menos un carácter de
 * cada clase para pasar el validador de fuerza del servidor, y descarta
 * caracteres ambiguos (O/0, l/1, etc.) para que sea legible al dictarla.
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // sin l, o
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // sin I, O
const DIGITS = "23456789"; // sin 0, 1
const SYMBOLS = "!@#$%&*?+-=";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function pick(chars: string): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return chars[arr[0] % chars.length];
}

export function generatePassword(length = 16): string {
  const len = Math.max(12, length);
  // Una de cada clase, garantizado.
  const base = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  for (let i = base.length; i < len; i++) base.push(pick(ALL));
  // Barajado Fisher-Yates con aleatoriedad segura, para no dejar las 4 fijas al inicio.
  for (let i = base.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join("");
}
