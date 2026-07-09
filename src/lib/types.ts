export type AccountKind = "propia" | "cliente";

export interface Account {
  id: string;
  name: string;
  handle: string;
  kind: AccountKind;
  color: string;
}

export type PieceFormat = "Reel" | "Carrusel" | "Stories" | "Ad";
export type PieceStatus = "Idea" | "Guion" | "Grabado" | "Editado" | "Aprobado" | "Programado";
export type PieceObjective = "DM" | "Agenda" | "Registro" | "Venta" | "Tráfico a perfil";

export const STATUSES: PieceStatus[] = ["Idea", "Guion", "Grabado", "Editado", "Aprobado", "Programado"];
export const FORMATS: PieceFormat[] = ["Reel", "Carrusel", "Stories", "Ad"];
export const OBJECTIVES: PieceObjective[] = ["DM", "Agenda", "Registro", "Venta", "Tráfico a perfil"];
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
  hook: string;
  summary: string;
  cta: string;
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
export type HeatCell = { day: string; hour: string; heat: number };
export type Insight = { title: string; text: string; color: string };

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
  role: "admin" | "client";
}

export interface ClientUserView {
  userId: string;
  email: string;
  accountId: string | null;
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
