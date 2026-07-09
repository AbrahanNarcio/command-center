import { AccountMetrics, Db, Piece, Source } from "./types";

function defaultMetrics(accountId: string, scale = 1): AccountMetrics {
  const s = (n: number) => Math.round(n * scale);
  return {
    accountId,
    updatedAt: new Date().toISOString(),
    kpis: [
      { label: "Vistas", value: `${(3.8 * scale).toFixed(1)}M`, delta: "+31%", detail: "Reels + stories en 30d", color: "#7a8cff" },
      { label: "Reach", value: `${(1.42 * scale).toFixed(2)}M`, delta: "+18%", detail: "Cuentas alcanzadas", color: "#feda75" },
      { label: "Seguidores", value: `${(187.4 * scale).toFixed(1)}K`, delta: `+${(4.8 * scale).toFixed(1)}K`, detail: "Crecimiento neto", color: "#80ffb5" },
      { label: "Interaccion", value: "8.7%", delta: "+2.1pp", detail: "ER promedio", color: "#ff5c9c" },
      { label: "Comentarios", value: `${(18.2 * scale).toFixed(1)}K`, delta: "+44%", detail: "Señal de conversación", color: "#ffa14e" },
      { label: "Retencion", value: "42%", delta: "+7pp", detail: "Reels completion avg", color: "#b05ce6" },
      { label: "CTR bio", value: "3.9%", delta: "+0.8pp", detail: "Clicks desde perfil", color: "#ff5d51" },
      { label: "Saves", value: `${(31.6 * scale).toFixed(1)}K`, delta: "+26%", detail: "Contenido de alta utilidad", color: "#7a8cff" },
      { label: "Shares", value: `${(12.9 * scale).toFixed(1)}K`, delta: "+19%", detail: "Contenido reenviable", color: "#feda75" },
      { label: "DMs", value: `${s(2184)}`, delta: "+38%", detail: "Conversaciones iniciadas", color: "#80ffb5" },
      { label: "Profile visits", value: `${(96.7 * scale).toFixed(1)}K`, delta: "+22%", detail: "Tráfico al perfil", color: "#ff5c9c" },
      { label: "Frecuencia", value: "3.1x", delta: "-0.4", detail: "Exposición por cuenta", color: "#ffa14e" },
    ],
    growth: [42, 46, 51, 49, 58, 61, 64, 70, 68, 76, 81, 78, 86, 93, 91, 96, 104, 112, 108, 118, 124, 132, 129, 141, 148, 153, 161, 170, 178, 186],
    growthNet: `+${(4.812 * scale).toFixed(3).replace(".", ".")}`,
    engagementRate: "8.7% ER",
    engagementMix: [
      { label: "Likes", value: "54%", color: "#7a8cff" },
      { label: "Comentarios", value: "19%", color: "#feda75" },
      { label: "Saves", value: "14%", color: "#ff5c9c" },
      { label: "Shares", value: "8%", color: "#ffa14e" },
      { label: "DMs", value: "5%", color: "#ff5d51" },
    ],
    reachByFormat: [
      { label: "Reels", pct: 92, color: "#7a8cff" },
      { label: "Carr.", pct: 63, color: "#feda75" },
      { label: "Stories", pct: 48, color: "#ff5c9c" },
      { label: "Ads", pct: 36, color: "#ffa14e" },
      { label: "Lives", pct: 24, color: "#80ffb5" },
    ],
    reachTotal: `${(1.42 * scale).toFixed(2)}M`,
    retention: [
      { label: "0-3s", pct: 100, color: "#7a8cff" },
      { label: "3-8s", pct: 78, color: "#80ffb5" },
      { label: "8-15s", pct: 57, color: "#feda75" },
      { label: "15-30s", pct: 42, color: "#ffa14e" },
      { label: "Final", pct: 31, color: "#ff5d51" },
    ],
    retentionAvg: "42%",
    funnel: [
      { label: "Reach", value: `${(1.42 * scale).toFixed(2)}M`, pct: 100, color: "#7a8cff" },
      { label: "Profile visits", value: `${(96.7 * scale).toFixed(1)}K`, pct: 68, color: "#feda75" },
      { label: "Bio clicks", value: `${s(3772)}`, pct: 42, color: "#ffa14e" },
      { label: "DM starts", value: `${s(2184)}`, pct: 31, color: "#ff5c9c" },
      { label: "Agendas", value: `${s(248)}`, pct: 18, color: "#80ffb5" },
    ],
    ctrBio: "3.9%",
    heatmap: [
      { day: "Lun", hour: "10h", heat: 78 }, { day: "Mar", hour: "12h", heat: 64 }, { day: "Mie", hour: "15h", heat: 86 }, { day: "Jue", hour: "11h", heat: 92 }, { day: "Vie", hour: "17h", heat: 74 }, { day: "Sab", hour: "20h", heat: 58 }, { day: "Dom", hour: "19h", heat: 69 },
      { day: "Lun", hour: "18h", heat: 71 }, { day: "Mar", hour: "21h", heat: 52 }, { day: "Mie", hour: "09h", heat: 66 }, { day: "Jue", hour: "19h", heat: 81 }, { day: "Vie", hour: "12h", heat: 88 }, { day: "Sab", hour: "11h", heat: 62 }, { day: "Dom", hour: "20h", heat: 73 },
    ],
    insights: [
      { title: "Dolor dominante", text: "La audiencia confunde volumen de posteos con sistema de demanda.", color: "#7a8cff" },
      { title: "Objeción caliente", text: "No quieren vender agresivo, pero tampoco quieren seguir invisibles.", color: "#ff5d51" },
      { title: "Frase reusable", text: "No me falta contenido, me falta que alguien me responda los DMs.", color: "#feda75" },
      { title: "Creencia a romper", text: "Postear más no arregla un mensaje que no hace elegir.", color: "#ff5c9c" },
    ],
  };
}

const piecesSeed: Omit<Piece, "id" | "accountId">[] = [
  { format: "Reel", status: "Aprobado", owner: "Abrahan", day: "Lun", time: "10:00", objective: "DM", hook: "Tu contenido no vende porque está educando demasiado.", summary: "Pieza dura contra el contenido tibio que explica mucho y no genera deseo.", cta: "Comenta SISTEMA", score: 94 },
  { format: "Carrusel", status: "Guion", owner: "Abrahan", day: "Lun", time: "13:30", objective: "Agenda", hook: "Si dependes de referidos, no tienes negocio: tienes suerte.", summary: "Carrusel de 8 slides para romper la dependencia y empujar el sistema.", cta: "Manda ESCALA", score: 82 },
  { format: "Stories", status: "Programado", owner: "Equipo", day: "Mar", time: "18:00", objective: "DM", hook: "¿Quieres que te diga por qué tu perfil no agenda?", summary: "Secuencia de 6 stories con encuesta, prueba social y CTA a conversación.", cta: "Responder PERFIL", score: 88 },
  { format: "Ad", status: "Idea", owner: "Equipo", day: "Mar", time: "21:00", objective: "Tráfico a perfil", hook: "No te falta alcance. Te falta un motivo para que te sigan.", summary: "Guion de anuncio con hook visual simple y el perfil como activo comercial.", cta: "Ir al perfil", score: 61 },
  { format: "Reel", status: "Grabado", owner: "Abrahan", day: "Mie", time: "09:30", objective: "Venta", hook: "El lead que te dice 'lo pienso' ya decidió algo.", summary: "Mini historia de objeción y cómo convertirla en contenido.", cta: "Manda LLAMADA", score: 78 },
  { format: "Carrusel", status: "Editado", owner: "Equipo", day: "Mie", time: "15:00", objective: "Registro", hook: "7 señales de que tu ManyChat está decorando, no vendiendo.", summary: "Checklist con errores de automatización sin conversación real.", cta: "Guárdalo y audita tu flujo", score: 89 },
  { format: "Reel", status: "Guion", owner: "Abrahan", day: "Jue", time: "11:00", objective: "DM", hook: "Tu VSL no está rota por larga. Está rota por cobarde.", summary: "Ataque a las VSL que no nombran el dolor ni tensionan la decisión.", cta: "Comenta VSL", score: 96 },
  { format: "Stories", status: "Idea", owner: "Equipo", day: "Jue", time: "19:30", objective: "Agenda", hook: "La diferencia entre contenido bonito y contenido que agenda.", summary: "Stories comparando una pieza tibia contra una con tensión y CTA claro.", cta: "Responder AGENDA", score: 57 },
  { format: "Ad", status: "Aprobado", owner: "Equipo", day: "Vie", time: "12:00", objective: "Registro", hook: "Si tu solución para vender más es publicar más, estás perdido.", summary: "Anuncio corto contra el volumen sin sistema de demanda.", cta: "Regístrate", score: 84 },
  { format: "Reel", status: "Editado", owner: "Abrahan", day: "Vie", time: "17:00", objective: "DM", hook: "No estás vendiendo caro. Estás explicando barato.", summary: "Respuesta a la objeción de precio con reencuadre de la percepción de valor.", cta: "Manda PRECIO", score: 87 },
  { format: "Carrusel", status: "Programado", owner: "Equipo", day: "Sab", time: "11:30", objective: "Tráfico a perfil", hook: "El algoritmo no te odia. La gente te ignora.", summary: "Separar el problema de distribución del problema de mensaje.", cta: "Revisa tu perfil", score: 90 },
  { format: "Stories", status: "Grabado", owner: "Abrahan", day: "Dom", time: "20:00", objective: "Venta", hook: "Si sigues esperando claridad, se te pasa el mercado.", summary: "Secuencia de cierre para mover leads tibios al DM.", cta: "Responder CLARIDAD", score: 74 },
];

const sourcesSeed: Omit<Source, "id" | "accountId">[] = [
  { name: "Transcripciones YouTube", type: "Material largo", summary: "Material largo para extraer piedras, historias, frameworks y objeciones.", tags: ["marca personal", "ventas", "Instagram"] },
  { name: "ManyChat DMs", type: "Export", summary: "Preguntas repetidas, objeciones y lenguaje literal de leads.", tags: ["objeciones", "DM", "urgencia", "frases reales"] },
  { name: "Llamadas de venta", type: "Transcripciones", summary: "Dolores profundos, vergüenzas y objeciones antes del cierre.", tags: ["precio", "confianza", "decisión", "cierre"] },
  { name: "Comentarios IG", type: "Placeholder", summary: "Preparado para cuando exista conexión autorizada a Instagram.", tags: ["offline", "webhooks", "Graph API"] },
  { name: "Banco de ángulos", type: "Curado", summary: "Referidos, ads mal usados, VSL rota, setters, CTA agresivo.", tags: ["piedras", "ads", "VSL", "referidos"] },
  { name: "Quality Bar", type: "Reglas", summary: "Hook, tensión, creencia rota, utilidad, CTA y grababilidad.", tags: ["score", "gate", "aprobación"] },
];

let counter = 0;
export function newId(prefix: string) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Métricas en cero para cuentas nuevas (arrancan vacías; se llenan a mano o por sync). */
export function emptyMetrics(accountId: string): AccountMetrics {
  const zeroKpis = defaultMetrics(accountId, 1).kpis.map((k) => ({ ...k, value: "—", delta: "" }));
  return {
    accountId,
    updatedAt: new Date().toISOString(),
    kpis: zeroKpis,
    growth: [0, 0],
    growthNet: "—",
    engagementRate: "— ER",
    engagementMix: [
      { label: "Likes", value: "0%", color: "#7a8cff" },
      { label: "Comentarios", value: "0%", color: "#feda75" },
      { label: "Saves", value: "0%", color: "#ff5c9c" },
      { label: "Shares", value: "0%", color: "#ffa14e" },
      { label: "DMs", value: "0%", color: "#ff5d51" },
    ],
    reachByFormat: [
      { label: "Reels", pct: 0, color: "#7a8cff" },
      { label: "Carr.", pct: 0, color: "#feda75" },
      { label: "Stories", pct: 0, color: "#ff5c9c" },
      { label: "Ads", pct: 0, color: "#ffa14e" },
      { label: "Lives", pct: 0, color: "#80ffb5" },
    ],
    reachTotal: "—",
    retention: [
      { label: "0-3s", pct: 0, color: "#7a8cff" },
      { label: "3-8s", pct: 0, color: "#80ffb5" },
      { label: "8-15s", pct: 0, color: "#feda75" },
      { label: "15-30s", pct: 0, color: "#ffa14e" },
      { label: "Final", pct: 0, color: "#ff5d51" },
    ],
    retentionAvg: "—",
    funnel: [
      { label: "Reach", value: "—", pct: 0, color: "#7a8cff" },
      { label: "Profile visits", value: "—", pct: 0, color: "#feda75" },
      { label: "Bio clicks", value: "—", pct: 0, color: "#ffa14e" },
      { label: "DM starts", value: "—", pct: 0, color: "#ff5c9c" },
      { label: "Agendas", value: "—", pct: 0, color: "#80ffb5" },
    ],
    ctrBio: "—",
    heatmap: defaultMetrics(accountId, 1).heatmap.map((h) => ({ ...h, heat: 0 })),
    insights: [],
  };
}

export function buildSeed(): Db {
  const accounts = [
    { id: "acc_abrahan", name: "Abrahan Narcio", handle: "@soyabrahannarcio", kind: "propia" as const, color: "#7a8cff" },
    { id: "acc_demo", name: "Cliente Demo", handle: "@cliente.demo", kind: "cliente" as const, color: "#feda75" },
  ];
  const pieces: Piece[] = [];
  const sources: Source[] = [];
  for (const account of accounts) {
    for (const piece of piecesSeed) pieces.push({ ...piece, id: newId("pz"), accountId: account.id });
    for (const source of sourcesSeed) sources.push({ ...source, id: newId("src"), accountId: account.id });
  }
  return {
    accounts,
    pieces,
    sources,
    metrics: [defaultMetrics("acc_abrahan", 1), defaultMetrics("acc_demo", 0.4)],
    connections: [],
  };
}

export { defaultMetrics };
