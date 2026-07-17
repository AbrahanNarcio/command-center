export type AccountKind = "propia" | "cliente";

export interface Account {
  id: string;
  name: string;
  handle: string;
  kind: AccountKind;
  color: string;
}

export type PieceFormat = "Reel" | "Carrusel" | "Historias" | "Ad";
export type PieceStatus = "Idea" | "Guion" | "Grabado" | "Editado" | "Aprobado" | "Programado";
export type PieceObjective = "DM" | "Agenda" | "Registro" | "Venta" | "Tráfico a perfil";
/** Tipo de ángulo de la pieza, con código de color fijo. */
export type PieceAngle = "Problema" | "Solución" | "Producto" | "Mentalidad";

export const STATUSES: PieceStatus[] = ["Idea", "Guion", "Grabado", "Editado", "Aprobado", "Programado"];
export const FORMATS: PieceFormat[] = ["Reel", "Carrusel", "Historias", "Ad"];
export const OBJECTIVES: PieceObjective[] = ["DM", "Agenda", "Registro", "Venta", "Tráfico a perfil"];
export const ANGLES: PieceAngle[] = ["Problema", "Solución", "Producto", "Mentalidad"];
/** Código de color del ángulo: problema rojo, solución verde, producto azul, mentalidad amarillo.
 *  Referencian variables de tema para que el tono se adapte al modo claro/oscuro. */
export const ANGLE_COLORS: Record<PieceAngle, string> = {
  Problema: "var(--coral)",
  Solución: "var(--green)",
  Producto: "var(--cyan)",
  Mentalidad: "var(--lime)",
};
export const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"] as const;
export type Day = (typeof DAYS)[number];

/** Día de la semana (abreviado) que corresponde a una fecha YYYY-MM-DD, en hora local. */
export function dayFromDate(date: string): Day {
  const [y, m, d] = date.split("-").map(Number);
  // getDay(): 0=domingo … 6=sábado. Reordenado a Lun-primero.
  const idx = [6, 0, 1, 2, 3, 4, 5][new Date(y, m - 1, d).getDay()];
  return DAYS[idx];
}

export interface Piece {
  id: string;
  accountId: string;
  format: PieceFormat;
  status: PieceStatus;
  owner: string;
  day: Day;
  time: string;
  objective: PieceObjective;
  /** Fecha programada YYYY-MM-DD (opcional). Ubica la pieza en el calendario mensual. */
  date?: string;
  angle: PieceAngle;
  hook: string;
  /** Cuerpo del guion (desarrollo entre el hook y el CTA). */
  cuerpo: string;
  cta: string;
  /** Resumen corto para la tarjeta (se deriva del guion si queda vacío). */
  summary: string;
  score: number;
}

export interface Source {
  id: string;
  accountId: string;
  name: string;
  type: string;
  summary: string;
  tags: string[];
}

export type Kpi = { label: string; value: string; delta: string; detail: string; color: string };
export type LabeledValue = { label: string; value: string; color: string };
export type LabeledPct = { label: string; pct: number; color: string };
export type FunnelStep = { label: string; value: string; pct: number; color: string };
/** Retención de un reel: FunnelStep + miniatura y enlace (opcionales para datos viejos). */
export type ReelRetention = FunnelStep & { thumb?: string; permalink?: string };
export type HeatCell = { day: string; hour: string; heat: number };
export type Insight = { title: string; text: string; color: string };
export type RecentPost = {
  id: string;
  thumb: string;
  permalink: string;
  caption: string;
  likes: number;
  comments: number;
  format: string;
};

/** Una rebanada demográfica: etiqueta legible + conteo real + % del total. */
export type AudienceSlice = { label: string; value: number; pct: number };
/** Demografía de un público (género y edad), con el total que suma cada breakdown.
 *  `windowLabel` = periodo REAL del que vienen los datos (Meta a veces devuelve
 *  vacío para una ventana y datos para otra; la UI muestra la que sí respondió). */
export type AudienceBreakdown = {
  total: number;
  gender: AudienceSlice[];
  age: AudienceSlice[];
  windowLabel?: string;
};
/** Publicación del feed con los seguidores que generó (métrica `follows` de Meta).
 *  Meta NO expone este dato para reels (verificado en vivo): solo posts/carruseles. */
export type FollowsPost = {
  id: string;
  thumb: string;
  permalink: string;
  caption: string;
  follows: number;
  /** Fecha de publicación YYYY-MM-DD. */
  date: string;
  format: string;
};

export interface AccountMetrics {
  accountId: string;
  updatedAt: string;
  kpis: Kpi[];
  growth: number[];
  growthNet: string;
  engagementRate: string;
  engagementMix: LabeledValue[];
  reachByFormat: LabeledPct[];
  reachTotal: string;
  retention: LabeledPct[];
  retentionAvg: string;
  funnel: FunnelStep[];
  ctrBio: string;
  heatmap: HeatCell[];
  insights: Insight[];
  /** Top publicaciones reales (reemplaza a retención cuando hay sync). */
  topPosts?: FunnelStep[];
  /** Fecha (YYYY-MM-DD) del último snapshot de seguidores, para un punto por día. */
  growthStamp?: string;
  /** Foto de perfil de IG. Las URLs de Meta caducan; se renuevan en cada sync. */
  avatarUrl?: string;
  /** Últimas publicaciones con miniatura, para la vista previa. */
  recentPosts?: RecentPost[];
  /** Retención real de reels: tiempo promedio de visualización por reel (API oficial). */
  reelsRetention?: ReelRetention[];
  /** KPIs por rango de tiempo ("1" hoy, "7" y "30" días) para el selector de rango. */
  kpiRanges?: Record<string, Kpi[]>;
  /** Serie diaria real de seguidores ganados/perdidos. El sync la acumula (hasta 400 días). */
  followersDaily?: { date: string; gained: number; lost: number }[];
  /** Días recientes con cambio de seguidores fuera de lo normal (detectados en el sync). */
  anomalies?: { date: string; net: number }[];
  /** Historias activas en el último sync: vistas, respuestas, salidas y % que la terminó. */
  stories?: { label: string; views: number | null; replies: number | null; exits: number | null; completion: number | null }[];
  /** Total de seguidores al momento del último sync, para reconstruir la serie de totales. */
  followersTotal?: number;
  /** Demografía de los seguidores actuales (foto al día del sync). Meta solo la
   *  expone para cuentas con suficientes seguidores (~100+). */
  audienceFollowers?: AudienceBreakdown;
  /** Demografía del público alcanzado en los últimos 30 días. */
  audienceReached?: AudienceBreakdown;
  /** Publicaciones del feed ordenadas por seguidores ganados (métrica follows). */
  followsPosts?: FollowsPost[];
}

/** Secciones que un reporte puede incluir (elegidas al generarlo). */
export type ReportSection = "kpis" | "growth" | "mix" | "topPosts" | "retention" | "funnel";

/** Parámetros con los que se generó un reporte. Viaja DENTRO de data (jsonb),
 *  así no requiere migración y sobrevive al restore. Ausente en reportes viejos
 *  = snapshot completo sin periodo. */
export type ReportMeta = {
  /** Clave del periodo ("7" | "30" días). */
  period?: string;
  /** Etiqueta legible del periodo ("Últimos 30 días"). */
  periodLabel?: string;
  /** Secciones incluidas. Ausente = todas las disponibles. */
  sections?: ReportSection[];
};

/** Snapshot congelado de métricas, para histórico y PDF. */
export interface Report {
  id: string;
  accountId: string;
  title: string;
  note: string;
  createdAt: string;
  data: AccountMetrics & { reportMeta?: ReportMeta };
}

export type ConnectionStatus = "connected" | "error" | "expired";

/** Server-side connection record. NEVER serialized to the client with token fields. */
export interface AccountConnection {
  accountId: string;
  igUserId: string;
  username: string;
  accountType: string;
  scopes: string[];
  /** Encrypted long-lived token (AES-256-GCM). Server-only. */
  tokenEnc: string;
  tokenIv: string;
  tokenTag: string;
  expiresAt: string;
  connectedAt: string;
  lastSyncAt: string | null;
  status: ConnectionStatus;
  error: string | null;
}

/** Client-safe view of a connection: no token material. */
export interface PublicConnection {
  accountId: string;
  igUserId: string;
  username: string;
  accountType: string;
  scopes: string[];
  expiresAt: string;
  connectedAt: string;
  lastSyncAt: string | null;
  status: ConnectionStatus;
  error: string | null;
}

export interface Db {
  accounts: Account[];
  pieces: Piece[];
  sources: Source[];
  metrics: AccountMetrics[];
  connections: AccountConnection[];
}

export interface Me {
  email: string;
  role: "admin" | "editor" | "viewer";
}

export interface ClientUserView {
  userId: string;
  email: string;
  accountId: string | null;
  /** 'client'/'viewer' = solo lectura; 'editor' = mueve su propia cuenta. */
  role?: string;
}

/** Payload sent to the browser — connections stripped of token material. */
export interface PublicDb {
  accounts: Account[];
  pieces: Piece[];
  sources: Source[];
  metrics: AccountMetrics[];
  connections: PublicConnection[];
  igConfigured: boolean;
  me: Me;
  /** Admin only: logins de clientes creados (vacío para viewers). */
  clientUsers: ClientUserView[];
  /** Correos que pueden ser responsables de una pieza (usuarios del sistema). */
  assignees: string[];
}

export function toPublicConnection(c: AccountConnection): PublicConnection {
  return {
    accountId: c.accountId,
    igUserId: c.igUserId,
    username: c.username,
    accountType: c.accountType,
    scopes: c.scopes,
    expiresAt: c.expiresAt,
    connectedAt: c.connectedAt,
    lastSyncAt: c.lastSyncAt,
    status: c.status,
    error: c.error,
  };
}

/* ── Mensajes de Instagram (bandeja + etiquetas de lead) ────── */

/** Etiquetas de lead disponibles (nuestras, no de Meta). Colores del sistema:
 *  mismo concepto = mismo color en toda la app. */
export const LEAD_TAGS = ["Nuevo", "Interesado", "Agendado", "Cliente", "Frío"] as const;
export type LeadTag = (typeof LEAD_TAGS)[number];
export const LEAD_TAG_COLORS: Record<LeadTag, string> = {
  Nuevo: "var(--cyan)",
  Interesado: "var(--lime)",
  Agendado: "var(--amber)",
  Cliente: "var(--green)",
  Frío: "var(--muted)",
};

/** Conversación de DM con una persona. tags/note son propias de Content OS. */
export interface IgConversation {
  id: string;
  accountId: string;
  igsid: string;
  username: string;
  /** Foto de perfil del contacto (URL del CDN de Meta; caduca — la refresca el sync). */
  avatarUrl: string;
  lastMessageAt: string | null;
  lastSnippet: string;
  unread: boolean;
  tags: string[];
  note: string;
}

export interface IgMessage {
  id: string;
  conversationId: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
}
