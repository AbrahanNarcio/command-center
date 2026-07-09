/**
 * Setup inicial de la base (idempotente, se puede correr varias veces):
 *   1. Crea el usuario ADMIN (email + contraseña).
 *   2. Crea tu cuenta propia (vacía).
 *   3. Crea la cuenta Demo con datos de ejemplo.
 *
 * Uso:  npm run setup -- tu@email.com TuContraseñaSegura
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { buildSeed, defaultMetrics, emptyMetrics } from "../src/lib/seed";
import { AccountMetrics } from "../src/lib/types";

function loadEnvLocal() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].trim();
    }
  } catch {
    /* sin .env.local: se esperan variables ya en el entorno */
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = (process.argv[2] || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const adminPassword = process.argv[3] || process.env.ADMIN_PASSWORD || "";

if (!url || !serviceKey) {
  console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}
if (!adminEmail.includes("@") || adminPassword.length < 8) {
  console.error("✗ Uso: npm run setup -- tu@email.com ContraseñaMin8Caracteres");
  process.exit(1);
}

const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function ensureAdminUser(): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });
  if (created?.user) {
    console.log(`✓ Usuario admin creado: ${adminEmail}`);
    return created.user.id;
  }
  // Ya existe: buscarlo.
  if (error) {
    const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users.find((u) => u.email?.toLowerCase() === adminEmail);
    if (existing) {
      console.log(`✓ Usuario admin ya existía: ${adminEmail}`);
      return existing.id;
    }
    throw new Error(`No se pudo crear el admin: ${error.message}`);
  }
  throw new Error("Estado inesperado creando el admin");
}

async function upsertMetrics(metrics: AccountMetrics) {
  const { accountId, updatedAt, ...data } = metrics;
  void updatedAt;
  const { error } = await db.from("metrics").upsert({ account_id: accountId, data, updated_at: new Date().toISOString() });
  if (error) throw new Error(`metrics ${accountId}: ${error.message}`);
}

async function main() {
  console.log("— Setup IG Command Center —");

  // 1. Admin
  const adminId = await ensureAdminUser();
  const { error: profileError } = await db.from("profiles").upsert({
    user_id: adminId,
    email: adminEmail,
    role: "admin",
    account_id: null,
  });
  if (profileError) throw new Error(`profile admin: ${profileError.message}`);
  console.log("✓ Perfil admin listo");

  // 2. Cuenta propia — vacía
  const { error: ownError } = await db.from("accounts").upsert({
    id: "acc_abrahan",
    name: "Abrahan Narcio",
    handle: "@soyabrahannarcio",
    kind: "propia",
    color: "#58e6ff",
    is_demo: false,
  });
  if (ownError) throw new Error(`cuenta propia: ${ownError.message}`);
  const { count } = await db.from("metrics").select("account_id", { count: "exact", head: true }).eq("account_id", "acc_abrahan");
  if (!count) await upsertMetrics(emptyMetrics("acc_abrahan"));
  console.log("✓ Cuenta propia lista (vacía, se llena con el sync de Instagram)");

  // 3. Cuenta demo con datos de ejemplo
  const { error: demoError } = await db.from("accounts").upsert({
    id: "acc_demo",
    name: "Cuenta Demo",
    handle: "@demo.commandcenter",
    kind: "cliente",
    color: "#d8ff63",
    is_demo: true,
  });
  if (demoError) throw new Error(`cuenta demo: ${demoError.message}`);

  const seed = buildSeed();
  const demoPieces = seed.pieces.filter((p) => p.accountId === "acc_demo");
  const demoSources = seed.sources.filter((s) => s.accountId === "acc_demo");

  const { count: pieceCount } = await db.from("pieces").select("id", { count: "exact", head: true }).eq("account_id", "acc_demo");
  if (!pieceCount) {
    const { error } = await db.from("pieces").insert(
      demoPieces.map((p) => ({
        id: p.id, account_id: p.accountId, format: p.format, status: p.status, owner: p.owner,
        day: p.day, time: p.time, objective: p.objective, hook: p.hook, summary: p.summary, cta: p.cta, score: p.score,
      })),
    );
    if (error) throw new Error(`pieces demo: ${error.message}`);
    const { error: srcError } = await db.from("sources").insert(
      demoSources.map((s) => ({ id: s.id, account_id: s.accountId, name: s.name, type: s.type, summary: s.summary, tags: s.tags })),
    );
    if (srcError) throw new Error(`sources demo: ${srcError.message}`);
    await upsertMetrics(defaultMetrics("acc_demo", 0.4));
    console.log(`✓ Cuenta demo cargada (${demoPieces.length} piezas, ${demoSources.length} fuentes)`);
  } else {
    console.log("✓ Cuenta demo ya tenía datos, no se duplicó");
  }

  console.log("\nListo. Entrá con tu email y contraseña de admin en /login.");
}

main().catch((err) => {
  console.error(`✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
