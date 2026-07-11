import { NextResponse } from "next/server";
import { accountGate } from "@/lib/auth";
import { getSourceForAccount } from "@/lib/db";
import { ANGLES, FORMATS, OBJECTIVES } from "@/lib/types";

/**
 * Generación REAL de guiones con la API de Claude (Anthropic). Corre solo en el
 * servidor: la key jamás llega al navegador. Sin ANTHROPIC_API_KEY responde 503
 * con instrucciones claras (nada de guiones fingidos).
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-sonnet-5";

type GenResult = { angle: string; hook: string; cuerpo: string; cta: string };

function buildPrompt(opts: {
  format: string;
  objective: string;
  edge: number;
  sourceName?: string;
  sourceText?: string;
  handle?: string;
}): string {
  const { format, objective, edge, sourceName, sourceText, handle } = opts;
  const tono =
    edge >= 5 ? "confrontativo y sin anestesia" : edge >= 4 ? "directo y con filo" : edge >= 3 ? "directo pero didáctico" : edge >= 2 ? "cercano y claro" : "suave y educativo";
  return [
    `Eres un guionista senior de contenido corto para Instagram. Escribe UN guion en español neutro (sin regionalismos) para una pieza de formato "${format}" cuyo objetivo de negocio es "${objective}"${handle ? `, para la cuenta ${handle}` : ""}.`,
    "",
    sourceText
      ? `MATERIA PRIMA (usa estas ideas, frases y dolores reales como base del guion; fuente: "${sourceName}"):\n"""\n${sourceText.slice(0, 6000)}\n"""`
      : "No hay materia prima cargada: construye el guion solo a partir del formato y el objetivo, sin inventar datos específicos.",
    "",
    `Tono: ${tono} (nivel de filo ${edge}/5).`,
    "",
    "Reglas OBLIGATORIAS:",
    "- NO inventes cifras, testimonios, casos de éxito, nombres ni credenciales. Cero datos fabricados.",
    "- El hook es una sola frase que frena el scroll (máximo 15 palabras).",
    "- El cuerpo desarrolla la idea en 3 a 6 líneas cortas (separadas por saltos de línea), pensadas para decirse en voz alta.",
    "- El CTA es una sola instrucción concreta alineada al objetivo.",
    `- Elige el ángulo que mejor le quede entre exactamente estos: ${ANGLES.join(", ")}.`,
    "",
    'Responde SOLO con un JSON válido, sin markdown ni texto extra, con esta forma exacta: {"angle": "...", "hook": "...", "cuerpo": "...", "cta": "..."}',
  ].join("\n");
}

/** Extrae el JSON de la respuesta del modelo (tolera fences de markdown). */
function parseResult(text: string): GenResult | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (typeof obj.hook !== "string" || typeof obj.cuerpo !== "string" || typeof obj.cta !== "string") return null;
    return {
      angle: (ANGLES as readonly string[]).includes(obj.angle) ? obj.angle : "Problema",
      hook: obj.hook.trim(),
      cuerpo: obj.cuerpo.trim(),
      cta: obj.cta.trim(),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const accountId = typeof body.accountId === "string" ? body.accountId : "";
  if (!accountId) return NextResponse.json({ error: "Falta accountId" }, { status: 400 });

  const gate = await accountGate(accountId);
  if (gate.response) return gate.response;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "El generador con IA no está configurado: falta ANTHROPIC_API_KEY en las variables de entorno del servidor." },
      { status: 503 },
    );
  }

  const format = (FORMATS as readonly string[]).includes(body.format) ? body.format : "Reel";
  const objective = (OBJECTIVES as readonly string[]).includes(body.objective) ? body.objective : "DM";
  const edge = Math.max(1, Math.min(5, Number(body.edge) || 3));

  let sourceName: string | undefined;
  let sourceText: string | undefined;
  if (typeof body.sourceId === "string" && body.sourceId) {
    const source = await getSourceForAccount(body.sourceId, accountId);
    if (!source) return NextResponse.json({ error: "Esa fuente no existe en esta cuenta." }, { status: 404 });
    sourceName = source.name;
    sourceText = source.summary;
  }

  const prompt = buildPrompt({
    format,
    objective,
    edge,
    sourceName,
    sourceText,
    handle: typeof body.handle === "string" ? body.handle : undefined,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch {
    return NextResponse.json({ error: "La IA no respondió a tiempo. Inténtalo de nuevo." }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.error?.message || `HTTP ${res.status}`;
    return NextResponse.json({ error: `Error de la IA: ${detail}` }, { status: 502 });
  }

  const text = Array.isArray(data?.content)
    ? data.content.map((b: { type?: string; text?: string }) => (b.type === "text" ? b.text : "")).join("")
    : "";
  const result = parseResult(text);
  if (!result) {
    return NextResponse.json({ error: "La IA respondió en un formato inesperado. Genera de nuevo." }, { status: 502 });
  }

  return NextResponse.json({ ...result, source: sourceName ?? null });
}
