import { Clapperboard, CircleDashed, Images, Megaphone } from "lucide-react";
import { PieceFormat } from "@/lib/types";

/** Cómo se presenta cada formato al cliente: icono, color del código de
 *  formato (el mismo de los badges) y una frase en lenguaje llano. */
export const FORMAT_META: Record<
  PieceFormat,
  { icon: React.ReactNode; color: string; label: string; hint: string }
> = {
  Reel: {
    icon: <Clapperboard size={14} />,
    color: "var(--cyan)",
    label: "Reel",
    hint: "Video para el feed",
  },
  Carrusel: {
    icon: <Images size={14} />,
    color: "var(--lime)",
    label: "Carrusel",
    hint: "Publicación de varias imágenes",
  },
  Historias: {
    icon: <CircleDashed size={14} />,
    color: "var(--pink)",
    label: "Historias",
    hint: "Secuencia de historias del día",
  },
  Ad: {
    icon: <Megaphone size={14} />,
    color: "var(--amber)",
    label: "Anuncio",
    hint: "Este día se sube o rota el anuncio",
  },
};
