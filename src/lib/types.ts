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
/** Código de color del ángulo: problema rojo, solución verde, producto azul, mentalidad amarillo. */
export const ANGLE_COLORS: Record<PieceAngle, string> = {
  Problema: "#ff5d51",
  Solución: "#80ffb5",
  Producto: "#7a8cff",
  Mentalidad: "#feda75",
};
export const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"] as const;
export type Day = (typeof DAYS)[number];

export interface Piece {
  id: string;
  accountId: string;
  format: PieceFormat;
  status: PieceStatus;
  owner: string;
  day: Day;
  time: string;
  objective: PieceObjective;
  angle: PieceAngle;
  hook: string;
  /** Bloques del guion, en orden después del hook. */
  problema: string;
  solucion: string;
  pruebaSocial: string;
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
}

/** Snapshot congelado de métricas, para histórico y PDF. */
export interface Report {
  id: string;
  accountId: string;
  title: string;
  note: string;
  createdAt: string;
  data: AccountMetrics;
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
