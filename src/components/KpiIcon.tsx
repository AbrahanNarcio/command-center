"use client";

import {
  Bookmark,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  MousePointerClick,
  Radar,
  Repeat,
  Send,
  Share2,
  Timer,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Zap,
} from "lucide-react";

/** Icono temático por etiqueta de KPI (cubre las reales del sync y las del seed). */
const ICONS: [RegExp, React.ReactNode][] = [
  [/vistas|views/i, <Eye key="i" />],
  [/reach|alcance/i, <Radar key="i" />],
  [/seguidores/i, <Users key="i" />],
  [/interacci/i, <Zap key="i" />],
  [/likes|me gusta/i, <Heart key="i" />],
  [/comentarios/i, <MessageCircle key="i" />],
  [/saves/i, <Bookmark key="i" />],
  [/shares/i, <Share2 key="i" />],
  [/engagement/i, <UserCheck key="i" />],
  [/taps/i, <MousePointerClick key="i" />],
  [/ctr|link/i, <Link2 key="i" />],
  [/frecuencia/i, <Repeat key="i" />],
  [/follows/i, <UserPlus key="i" />],
  [/dms/i, <Send key="i" />],
  [/retencion|retención/i, <Timer key="i" />],
  [/profile|perfil/i, <UserRound key="i" />],
];

export default function KpiIcon({ label }: { label: string }) {
  const match = ICONS.find(([re]) => re.test(label));
  return <i className="metric-icon">{match ? match[1] : <TrendingUp />}</i>;
}
