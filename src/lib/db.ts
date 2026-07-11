import { adminClient } from "./supabase/admin";
import {
  Account,
  AccountConnection,
  AccountMetrics,
  Piece,
  Report,
  Source,
} from "./types";

/* ── row ↔ type mappers ─────────────────────────────────────── */

type AccountRow = { id: string; name: string; handle: string; kind: string; color: string };
/** Guion guardado en jsonb. `cuerpo` es el modelo actual; los campos viejos
 *  (problema/solucion/pruebaSocial) se conservan opcionales solo para leer piezas
 *  anteriores y fundirlas en `cuerpo`. */
type PieceScript = {
  angle?: string;
  cuerpo?: string;
  problema?: string;
  solucion?: string;
  pruebaSocial?: string;
};
type PieceRow = {
  id: string; account_id: string; format: string; status: string; owner: string;
  day: string; time: string; objective: string; hook: string; summary: string; cta: string; score: number;
  script?: PieceScript | null; date?: string | null;
};
type SourceRow = { id: string; account_id: string; name: string; type: string; summary: string; tags: string[] };
type MetricsRow = { account_id: string; data: Omit<AccountMetrics, "accountId" | "updatedAt">; updated_at: string };
type ConnectionRow = {
  account_id: string; ig_user_id: string; username: string; account_type: string; scopes: string[];
  token_enc: string; token_iv: string; token_tag: string; expires_at: string; connected_at: string;
  last_sync_at: string | null; status: string; error: string | null;
};

const toAccount = (r: AccountRow): Account => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  kind: r.kind === "propia" ? "propia" : "cliente",
  color: r.color,
});

const toPiece = (r: PieceRow): Piece => {
  const s = r.script ?? {};
  const angle = (["Problema", "Solución", "Producto", "Mentalidad"].includes(s.angle ?? "")
    ? s.angle
    : "Problema") as Piece["angle"];
  return {
    id: r.id,
    accountId: r.account_id,
    format: r.format as Piece["format"],
    status: r.status as Piece["status"],
    owner: r.owner,
    day: r.day as Piece["day"],
    time: r.time,
    objective: r.objective as Piece["objective"],
    date: r.date ?? undefined,
    angle,
    hook: r.hook,
    // Piezas nuevas traen `cuerpo`; las viejas se reconstruyen uniendo sus bloques.
    cuerpo:
      s.cuerpo ??
      [s.problema, s.solucion, s.pruebaSocial].map((b) => (b ?? "").trim()).filter(Boolean).join("\n\n"),
    cta: r.cta,
    summary: r.summary,
    score: r.score,
  };
};

const toSource = (r: SourceRow): Source => ({
  id: r.id,
  accountId: r.account_id,
  name: r.name,
  type: r.type,
  summary: r.summary,
  tags: Array.isArray(r.tags) ? r.tags : [],
});

const toMetrics = (r: MetricsRow): AccountMetrics => ({
  ...r.data,
  accountId: r.account_id,
  updatedAt: r.updated_at,
});

const toConnection = (r: ConnectionRow): AccountConnection => ({
  accountId: r.account_id,
  igUserId: r.ig_user_id,
  username: r.username,
  accountType: r.account_type,
  scopes: Array.isArray(r.scopes) ? r.scopes : [],
  tokenEnc: r.token_enc,
  tokenIv: r.token_iv,
  tokenTag: r.token_tag,
  expiresAt: r.expires_at,
  connectedAt: r.connected_at,
  lastSyncAt: r.last_sync_at,
  status: (r.status as AccountConnection["status"]) ?? "connected",
  error: r.error,
});

function fail(op: string, error: { message: string } | null): never {
  throw new Error(`DB ${op}: ${error?.message ?? "error desconocido"}`);
}

/* ── reads ──────────────────────────────────────────────────── */

export interface FullData {
  accounts: Account[];
  pieces: Piece[];
  sources: Source[];
  metrics: AccountMetrics[];
  connections: AccountConnection[];
}

export async function getFullData(accountFilter?: string): Promise<FullData> {
  const db = adminClient();
  const acc = db.from("accounts").select("*").order("created_at");
  const pcs = db.from("pieces").select("*").order("created_at");
  const src = db.from("sources").select("*").order("created_at");
  const met = db.from("metrics").select("*");
  const con = db.from("connections").select("*");

  if (accountFilter) {
    acc.eq("id", accountFilter);
    pcs.eq("account_id", accountFilter);
    src.eq("account_id", accountFilter);
    met.eq("account_id", accountFilter);
    con.eq("account_id", accountFilter);
  }

  const [a, p, s, m, c] = await Promise.all([acc, pcs, src, met, con]);
  if (a.error) fail("accounts", a.error);
  if (p.error) fail("pieces", p.error);
  if (s.error) fail("sources", s.error);
  if (m.error) fail("metrics", m.error);
  if (c.error) fail("connections", c.error);

  return {
    accounts: (a.data as AccountRow[]).map(toAccount),
    pieces: (p.data as PieceRow[]).map(toPiece),
    sources: (s.data as SourceRow[]).map(toSource),
    metrics: (m.data as MetricsRow[]).map(toMetrics),
    connections: (c.data as ConnectionRow[]).map(toConnection),
  };
}

/* ── accounts ───────────────────────────────────────────────── */

export async function insertAccount(account: Account): Promise<Account> {
  const { error } = await adminClient().from("accounts").insert({
    id: account.id,
    name: account.name,
    handle: account.handle,
    kind: account.kind,
    color: account.color,
  });
  if (error) fail("insertAccount", error);
  return account;
}

export async function updateAccountRow(id: string, patch: Partial<Account>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.handle !== undefined) row.handle = patch.handle;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.color !== undefined) row.color = patch.color;
  const { error } = await adminClient().from("accounts").update(row).eq("id", id);
  if (error) fail("updateAccount", error);
}

export async function deleteAccountRow(id: string): Promise<void> {
  const { error } = await adminClient().from("accounts").delete().eq("id", id);
  if (error) fail("deleteAccount", error);
}

/* ── pieces ─────────────────────────────────────────────────── */

const scriptOf = (p: Partial<Piece>): PieceScript => ({
  angle: p.angle,
  cuerpo: p.cuerpo,
});
/** ¿El error es porque a la tabla le falta la columna opcional `col` (falta esa migración)? */
const missingColumn = (e: unknown, col: string): boolean =>
  !!e && typeof (e as { message?: string }).message === "string" &&
  new RegExp(`\\b${col}\\b`).test((e as { message: string }).message) &&
  /(column|does not exist|schema cache)/i.test((e as { message: string }).message);

type OpResult = { error: { message: string } | null; data?: unknown };

/** Intenta la operación; si falla por una columna opcional ausente, la quita y reintenta. */
async function withOptionalColumns(
  obj: Record<string, unknown>,
  run: (o: Record<string, unknown>) => PromiseLike<OpResult>,
): Promise<OpResult> {
  let current = obj;
  for (let i = 0; i < 3; i++) {
    const res = await run(current);
    if (!res.error) return res;
    const drop = (["date", "script"] as const).find((c) => c in current && missingColumn(res.error, c));
    if (!drop) return res;
    const { [drop]: _omit, ...rest } = current;
    void _omit;
    current = rest;
  }
  return run(current);
}

export async function insertPiece(piece: Piece): Promise<Piece> {
  const base = {
    id: piece.id,
    account_id: piece.accountId,
    format: piece.format,
    status: piece.status,
    owner: piece.owner,
    day: piece.day,
    time: piece.time,
    objective: piece.objective,
    hook: piece.hook,
    summary: piece.summary,
    cta: piece.cta,
    score: piece.score,
    script: scriptOf(piece),
    date: piece.date || null,
  };
  const { error } = await withOptionalColumns(base, (o) => adminClient().from("pieces").insert(o));
  if (error) fail("insertPiece", error);
  return piece;
}

export async function updatePieceRow(id: string, patch: Partial<Piece>): Promise<Piece | null> {
  const row: Record<string, unknown> = {};
  const map: [keyof Piece, string][] = [
    ["format", "format"], ["status", "status"], ["owner", "owner"], ["day", "day"],
    ["time", "time"], ["objective", "objective"], ["hook", "hook"], ["summary", "summary"], ["cta", "cta"],
  ];
  for (const [key, col] of map) if (patch[key] !== undefined) row[col] = patch[key];
  if (patch.score !== undefined) row.score = Math.max(0, Math.min(100, Number(patch.score) || 0));
  if (patch.date !== undefined) row.date = patch.date || null;
  // Solo tocar la columna script si el patch trae ángulo o cuerpo del guion.
  if (["angle", "cuerpo"].some((k) => k in patch)) row.script = scriptOf(patch);

  const res = await withOptionalColumns(row, (o) =>
    adminClient().from("pieces").update(o).eq("id", id).select().maybeSingle(),
  );
  if (res.error) fail("updatePiece", res.error);
  return res.data ? toPiece(res.data as PieceRow) : null;
}

export async function deletePieceRow(id: string): Promise<void> {
  const { error } = await adminClient().from("pieces").delete().eq("id", id);
  if (error) fail("deletePiece", error);
}

/* ── sources ────────────────────────────────────────────────── */

export async function insertSource(source: Source): Promise<Source> {
  const { error } = await adminClient().from("sources").insert({
    id: source.id,
    account_id: source.accountId,
    name: source.name,
    type: source.type,
    summary: source.summary,
    tags: source.tags,
  });
  if (error) fail("insertSource", error);
  return source;
}

export async function updateSourceRow(id: string, patch: Partial<Source>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.summary !== undefined) row.summary = patch.summary;
  if (patch.tags !== undefined) row.tags = patch.tags;
  const { error } = await adminClient().from("sources").update(row).eq("id", id);
  if (error) fail("updateSource", error);
}

export async function deleteSourceRow(id: string): Promise<void> {
  const { error } = await adminClient().from("sources").delete().eq("id", id);
  if (error) fail("deleteSource", error);
}

/* ── metrics ────────────────────────────────────────────────── */

export async function getMetricsRow(accountId: string): Promise<AccountMetrics | null> {
  const { data, error } = await adminClient().from("metrics").select("*").eq("account_id", accountId).maybeSingle();
  if (error) fail("getMetrics", error);
  return data ? toMetrics(data as MetricsRow) : null;
}

export async function upsertMetrics(metrics: AccountMetrics): Promise<void> {
  const { accountId, updatedAt: _updatedAt, ...data } = metrics;
  void _updatedAt;
  const { error } = await adminClient().from("metrics").upsert({
    account_id: accountId,
    data,
    updated_at: new Date().toISOString(),
  });
  if (error) fail("upsertMetrics", error);
}

/* ── connections ────────────────────────────────────────────── */

export async function getConnection(accountId: string): Promise<AccountConnection | null> {
  const { data, error } = await adminClient().from("connections").select("*").eq("account_id", accountId).maybeSingle();
  if (error) fail("getConnection", error);
  return data ? toConnection(data as ConnectionRow) : null;
}

export async function upsertConnection(conn: AccountConnection): Promise<void> {
  const { error } = await adminClient().from("connections").upsert({
    account_id: conn.accountId,
    ig_user_id: conn.igUserId,
    username: conn.username,
    account_type: conn.accountType,
    scopes: conn.scopes,
    token_enc: conn.tokenEnc,
    token_iv: conn.tokenIv,
    token_tag: conn.tokenTag,
    expires_at: conn.expiresAt,
    connected_at: conn.connectedAt,
    last_sync_at: conn.lastSyncAt,
    status: conn.status,
    error: conn.error,
  });
  if (error) fail("upsertConnection", error);
}

export async function patchConnection(
  accountId: string,
  patch: Partial<Pick<AccountConnection, "lastSyncAt" | "status" | "error" | "tokenEnc" | "tokenIv" | "tokenTag" | "expiresAt">>,
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.lastSyncAt !== undefined) row.last_sync_at = patch.lastSyncAt;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.tokenEnc !== undefined) row.token_enc = patch.tokenEnc;
  if (patch.tokenIv !== undefined) row.token_iv = patch.tokenIv;
  if (patch.tokenTag !== undefined) row.token_tag = patch.tokenTag;
  if (patch.expiresAt !== undefined) row.expires_at = patch.expiresAt;
  const { error } = await adminClient().from("connections").update(row).eq("account_id", accountId);
  if (error) fail("patchConnection", error);
}

export async function deleteConnectionRow(accountId: string): Promise<void> {
  const { error } = await adminClient().from("connections").delete().eq("account_id", accountId);
  if (error) fail("deleteConnection", error);
}

/* ── reports (snapshots congelados de métricas) ─────────────── */

type ReportRow = { id: string; account_id: string; title: string; note: string; data: AccountMetrics; created_at: string };

const toReport = (r: ReportRow): Report => ({
  id: r.id,
  accountId: r.account_id,
  title: r.title,
  note: r.note ?? "",
  createdAt: r.created_at,
  data: r.data,
});

export async function listReports(accountId: string): Promise<Report[]> {
  const { data, error } = await adminClient()
    .from("reports")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) fail("listReports", error);
  return (data as ReportRow[]).map(toReport);
}

export async function insertReport(report: Report): Promise<Report> {
  const { error } = await adminClient().from("reports").insert({
    id: report.id,
    account_id: report.accountId,
    title: report.title,
    note: report.note,
    data: report.data,
    created_at: report.createdAt,
  });
  if (error) fail("insertReport", error);
  return report;
}

export async function deleteReportRow(id: string): Promise<void> {
  const { error } = await adminClient().from("reports").delete().eq("id", id);
  if (error) fail("deleteReport", error);
}

/* ── client users (profiles) ────────────────────────────────── */

export interface ClientUser {
  userId: string;
  email: string;
  accountId: string | null;
  /** 'client'/'viewer' = solo lectura; 'editor' = mueve su propia cuenta. */
  role: string;
}

/** Correos de todos los usuarios registrados (para el selector de responsable).
 *  El equipo (admin/editor) primero, luego el resto, ambos por antigüedad. */
export async function listAssignableEmails(): Promise<string[]> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("email, role, created_at")
    .order("created_at");
  if (error) fail("listAssignableEmails", error);
  const rows = (data ?? []).filter((r) => r.email);
  const rank = (role: string | null) => (role === "admin" ? 0 : role === "editor" ? 1 : 2);
  return rows
    .sort((a, b) => rank(a.role) - rank(b.role))
    .map((r) => r.email as string);
}

export async function listClientUsers(): Promise<ClientUser[]> {
  const { data, error } = await adminClient()
    .from("profiles")
    .select("user_id, email, account_id, role")
    .neq("role", "admin")
    .order("created_at");
  if (error) fail("listClientUsers", error);
  return (data ?? []).map((r) => ({
    userId: r.user_id,
    email: r.email,
    accountId: r.account_id,
    role: r.role ?? "client",
  }));
}

/** Borra los usuarios auth de los clientes ligados a una cuenta (cascada al borrar la cuenta). */
export async function deleteClientUsersOf(accountId: string): Promise<void> {
  const db = adminClient();
  const { data, error } = await db
    .from("profiles")
    .select("user_id")
    .neq("role", "admin")
    .eq("account_id", accountId);
  if (error) fail("deleteClientUsersOf", error);
  for (const row of data ?? []) {
    await db.auth.admin.deleteUser(row.user_id);
  }
}

/** Cuenta a la que pertenece una fila (para el guard por cuenta en PATCH/DELETE). */
export async function rowAccountId(table: "pieces" | "sources" | "reports", id: string): Promise<string | null> {
  const { data, error } = await adminClient().from(table).select("account_id").eq("id", id).maybeSingle();
  if (error) fail(`rowAccountId:${table}`, error);
  return data?.account_id ?? null;
}
